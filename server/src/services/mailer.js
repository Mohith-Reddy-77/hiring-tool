const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || `no-reply@${(process.env.CLIENT_URL || 'localhost').replace(/^https?:\/\//, '')}`;

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

    const info = await t.sendMail({ from: FROM_EMAIL, to, subject, html });
    return { ok: true, info };
  } catch (e) {
    console.warn('sendInviteEmail failed:', e?.message || e);
    return { ok: false, reason: e?.message || String(e) };
  }
}

module.exports = { sendInviteEmail };
