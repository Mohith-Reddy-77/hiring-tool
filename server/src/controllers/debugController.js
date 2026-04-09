const mailer = require('../services/mailer');

// GET /api/debug/smtp
async function smtpCheck(req, res, next) {
  try {
    const enabled = String(process.env.ENABLE_SMTP_DEBUG || 'false').toLowerCase() === 'true';
    const token = process.env.SMTP_DEBUG_TOKEN || '';
    const header = req.headers['x-debug-token'] || '';
    if (!enabled) return res.status(403).json({ message: 'SMTP debug endpoint disabled' });
    if (token && token !== header) return res.status(401).json({ message: 'Invalid debug token' });

    const config = mailer.getMaskedConfig();
    const result = await mailer.verifyTransport(8000);
    return res.json({ config, result });
  } catch (e) {
    next(e);
  }
}

module.exports = { smtpCheck };
