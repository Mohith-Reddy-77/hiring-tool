const axios = require('axios');
const crypto = require('crypto');
const supa = require('../services/supabase');
const { signToken } = require('./authController');

function randomState() {
  return crypto.randomBytes(16).toString('hex');
}

function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function start(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // Ensure the redirect URI points at the server API callback route that is registered
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`}/api/auth/google/callback`;
  if (!clientId) return res.status(500).send('Google OAuth not configured');
  const state = randomState();
  // Log redirectUri and the built URL for debugging redirect_uri_mismatch errors
  try {
    const debugUrl = buildAuthUrl({ clientId, redirectUri, state });
    console.log('[googleAuth] redirectUri=', redirectUri);
    console.log('[googleAuth] authUrl=', debugUrl);
  } catch (e) {
    console.warn('[googleAuth] failed to build debug url', e?.message || e);
  }
  // Store state in a short-lived cookie for CSRF protection
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });
  const url = buildAuthUrl({ clientId, redirectUri, state });
  return res.redirect(url);
}

async function callback(req, res, next) {
  try {
    const { code, state } = req.query;
    const cookieState = req.cookies && req.cookies.oauth_state;
    if (!state || !cookieState || state !== cookieState) {
      return res.status(400).send('Invalid OAuth state');
    }
    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:
          process.env.GOOGLE_REDIRECT_URI ||
          `${process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
      {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { id_token, access_token } = tokenRes.data;
    if (!id_token) return res.status(500).send('No id_token from Google');

    // Decode id_token without verification for profile (we'll verify fields manually)
    const parts = id_token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const email = payload.email;
    const email_verified = payload.email_verified;
    const googleId = payload.sub;
    if (!email || !email_verified) return res.status(400).send('Email not verified by Google');

    // Upsert into users table
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).send('Supabase client not configured');

    // Try find existing user by google_id or email
    const { data: existingByGoogle, error: errGoogle } = await client.from('users').select('*').eq('google_id', googleId).limit(1);
    if (errGoogle) console.warn('[googleAuth] supa err finding by google_id:', errGoogle);
    let userRow = existingByGoogle && existingByGoogle[0];
    if (!userRow) {
      const { data: byEmail, error: errEmail } = await client.from('users').select('*').eq('email', email).limit(1);
      if (errEmail) console.warn('[googleAuth] supa err finding by email:', errEmail);
      if (byEmail && byEmail.length) {
        userRow = byEmail[0];
      }
    }

    if (userRow) {
      // Update google_id if missing
      if (!userRow.google_id) {
        const { data: _upd, error: updErr } = await client.from('users').update({ google_id: googleId }).eq('id', userRow.id).select();
        if (updErr) console.warn('[googleAuth] supa err updating google_id:', updErr);
      }
    } else {
      // Create new user with PENDING role by default
      const payloadUser = { name: payload.name || null, email, role: 'PENDING', google_id: googleId, created_at: new Date() };
      const { data: inserted, error: insertErr } = await client.from('users').insert(payloadUser).select();
      if (insertErr) {
        console.warn('[googleAuth] supa insert error:', insertErr);
      } else {
        userRow = inserted && inserted[0];
      }
    }

    if (!userRow) {
      console.error('[googleAuth] Failed to create or find user for email=', email, 'googleId=', googleId);
      return res.status(500).send('Failed to create or find user');
    }

    const token = signToken(userRow.id, userRow.role || 'PENDING');

    // Prepare client origin for postMessage (fall back to '*' if not provided)
    const clientOrigin = (process.env.CLIENT_URL && process.env.CLIENT_URL.trim()) || req.headers.origin || '*';

    // Build payload safely by JSON-encoding values on the server side
    const clientPayload = {
      token,
      user: { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role },
    };

    // Send a small HTML page that posts message back to opener and closes popup.
    // Include a fallback UI if postMessage or window.opener is not available.
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Signing in…</title>
  </head>
  <body>
    <div id="status">Completing sign-in…</div>
    <script>
      (function(){
        try {
          var payload = ${JSON.stringify(clientPayload)};
          var targetOrigin = ${JSON.stringify(clientOrigin)} || '*';
          if (window.opener && window.opener.postMessage) {
            window.opener.postMessage(payload, targetOrigin);
            // allow opener to receive message then close
            setTimeout(function(){ window.close(); }, 300);
            document.getElementById('status').textContent = 'Sign-in complete. You can close this window.';
          } else {
            document.getElementById('status').textContent = 'Sign-in complete. Please return to the application.';
          }
        } catch (err) {
          console.error('popup postMessage error', err);
          document.getElementById('status').textContent = 'Sign-in failed. Please close this window and try again.';
        }
      })();
    </script>
  </body>
</html>`;

    res.clearCookie('oauth_state');
    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (e) {
    next(e);
  }
}

module.exports = { start, callback };
