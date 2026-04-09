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
    const info = await t.sendMail({ from: FROM_EMAIL, to, subject, html });
    return { ok: true, info };
  } catch (e) {
    // Detect MailerSend specific verification error and return a clearer message
    const msg = e?.message || String(e);
    console.warn('sendInviteEmail failed:', msg);
    if (/from\.email domain must be verified|MS42207/i.test(msg)) {
      return { ok: false, reason: 'from.email domain not verified (MS42207): verify your sending domain in MailerSend or use the provider test sender' };
    }
    return { ok: false, reason: msg };
  }
}

module.exports = { sendInviteEmail };
