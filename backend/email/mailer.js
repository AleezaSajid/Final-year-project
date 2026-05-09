const nodemailer = require('nodemailer');

function env(name, fallback = '') {
  const v = process.env[name];
  return v != null ? String(v).trim() : fallback;
}

let cachedTransport = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT', '587'));
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');

  if (!host || !user || !pass) {
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: env('SMTP_SECURE', '').toLowerCase() === 'true', // true for 465
    auth: { user, pass },
  });

  return cachedTransport;
}

async function sendMailSafe(message) {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, reason: 'smtp_not_configured' };
  }

  try {
    await transport.sendMail(message);
    return { ok: true };
  } catch (err) {
    console.error('[email] sendMail failed', err);
    return { ok: false, reason: 'send_failed' };
  }
}

module.exports = { sendMailSafe };

