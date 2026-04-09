const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
// Prefer an explicit FROM_EMAIL; if not set, prefer the SMTP user (provider test sender),
// otherwise fallback to a no-reply derived from the client host.
const explicitFrom = process.env.FROM_EMAIL;
const derivedFallback = `no-reply@${(process.env.CLIENT_URL || 'localhost').replace(/^https?:\/\//, '')}`;
let FROM_EMAIL = explicitFrom || SMTP_USER || derivedFallback;
// If both explicit and SMTP_USER are set but SMTP_USER looks like a provider test sender
// (MailerSend test senders often contain 'MS_' or 'test-...mlsender.net'), prefer SMTP_USER
// to avoid provider 450 verification errors. Also override obvious placeholder addresses.
try {
  if (explicitFrom && SMTP_USER && SMTP_USER !== explicitFrom) {
    const smtpIsTest = /(^MS_)|(@test-.*mlsender\.net)|mlsender\.net/i.test(SMTP_USER);
    const explicitIsPlaceholder = /yourdomain\.com/i.test(explicitFrom);
    if (smtpIsTest || explicitIsPlaceholder) {
      console.info(`Overriding FROM_EMAIL (${explicitFrom}) with SMTP_USER (${SMTP_USER}) for provider compatibility`);
      FROM_EMAIL = SMTP_USER;
    }
  }
} catch (e) {
  // ignore
}

let transporter = null;
function getTransport() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER) {
    console.warn('Mailer not configured: set SMTP_HOST and SMTP_USER to enable email sending');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // timeouts in ms; increase defaults to accommodate slower hosts
    connectionTimeout: Number(process.env.SMTP_CONN_TIMEOUT_MS || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000),
  });
  // Log masked transport info for diagnostics (do not log secrets)
  try {
    const maskedUser = SMTP_USER ? (SMTP_USER.length > 6 ? `${SMTP_USER.slice(0, 3)}...${SMTP_USER.slice(-3)}` : SMTP_USER) : '<none>';
    console.info(`Mailer configured. host=${SMTP_HOST}, port=${SMTP_PORT}, user=${maskedUser}, from=${FROM_EMAIL}`);
  } catch (e) {
    // ignore logging errors
  }
  return transporter;
}

async function sendInviteEmail({ to, name, role, inviteerName }) {
  try {
    const t = getTransport();
    if (!t) return { ok: false, reason: 'mail not configured' };
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const loginUrl = `${clientUrl}/login`;
    const subject = `You were invited to join Hiring Tool as ${role}`;
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#111">
        <h2>You were invited to Hiring Tool</h2>
        <p>Hi ${name || 'there'},</p>
        <p>${inviteerName || 'An admin'} invited you to join the Hiring Tool portal with the role <strong>${role}</strong>.</p>
        <p>To access the portal, sign in with your Google account and choose the same email address:</p>
        <p style="text-align:center; margin:18px 0;"><a href="${loginUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Open Hiring Tool</a></p>
        <p>If you don't have an account yet, sign in with Google using the same email and you'll be granted access automatically.</p>
        <p style="color:#666;font-size:13px">If you weren't expecting this, you can ignore this message.</p>
      </div>
    `;

    console.info(`Sending invite email from=${FROM_EMAIL} to=${to}`);
    const mailOptions = { from: FROM_EMAIL, to, subject, html };
    const info = await t.sendMail(mailOptions);
    return { ok: true, info };
  } catch (e) {
    // Detect MailerSend specific verification error and return a clearer message
    const msg = e?.message || String(e);
    console.warn('sendInviteEmail failed:', msg);
    if (/from\.email domain must be verified|MS42207/i.test(msg)) {
      return { ok: false, reason: 'from.email domain not verified (MS42207): verify your sending domain in MailerSend or use the provider test sender' };
    }
    // If the error looks like a connection timeout, attempt fallback ports/transports
    if (/timeout|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|ECONNRESET/i.test(msg)) {
      try {
        console.info('Attempting SMTP fallback transports due to:', msg);
        const fallback = await tryFallbackSend(mailOptions || { from: FROM_EMAIL, to, subject, html });
        return fallback;
      } catch (e2) {
        console.warn('Fallback send threw unexpectedly:', e2?.message || e2);
        return { ok: false, reason: msg };
      }
    }
    return { ok: false, reason: msg };
  }
}

// Attempt to send using alternate ports/secure settings when initial send fails.
// This helper will not throw; it will return an object describing success/failure.
async function tryFallbackSend(mailOpts) {
  try {
    if (!mailOpts || typeof mailOpts !== 'object') {
      return { ok: false, reason: 'invalid mail options' };
    }
    const ports = [2525, 587, 465];
    for (const p of ports) {
      const secure = p === 465;
      try {
        console.info(`Trying fallback SMTP port=${p} secure=${secure}`);
        const altTransport = nodemailer.createTransport({
          host: SMTP_HOST,
          port: p,
          secure,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
          connectionTimeout: Number(process.env.SMTP_CONN_TIMEOUT_MS || 20000),
          greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
          socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000),
        });
        // quick verify with timeout
        await Promise.race([
          altTransport.verify(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('verify timeout')), Number(process.env.SMTP_CONN_TIMEOUT_MS || 20000))),
        ]);
        const info = await altTransport.sendMail(mailOpts);
        console.info(`Fallback send success port=${p}`);
        // replace global transporter so future sends use the working config
        transporter = altTransport;
        return { ok: true, info };
      } catch (e) {
        console.warn(`Fallback port ${p} failed:`, e?.message || e);
        // continue to next port
      }
    }
    return { ok: false, reason: 'All SMTP fallback attempts failed' };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

// Verify transporter connectivity with a timeout (ms)
async function verifyTransport(timeout = 8000) {
  const t = getTransport();
  if (!t) return { ok: false, reason: 'mail not configured' };
  // Wrap verify in a timeout
  const verifyPromise = t.verify();
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('verify timeout')), timeout));
  try {
    await Promise.race([verifyPromise, timeoutPromise]);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

// Expose masked config for diagnostics
function getMaskedConfig() {
  const maskedUser = SMTP_USER ? (SMTP_USER.length > 6 ? `${SMTP_USER.slice(0, 3)}...${SMTP_USER.slice(-3)}` : SMTP_USER) : '<none>';
  return {
    host: SMTP_HOST || null,
    port: SMTP_PORT || null,
    user: maskedUser,
    from: FROM_EMAIL || null,
  };
}

module.exports = { sendInviteEmail, verifyTransport, getMaskedConfig };
