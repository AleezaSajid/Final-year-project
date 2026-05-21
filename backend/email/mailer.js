
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const nodemailer = require('nodemailer');
const { makeOtpEmail } = require('./templates/otpEmail');

const OTP_EMAIL_FAIL_MESSAGE = 'OTP email failed to send. Check SMTP configuration.';
const DEFAULT_OTP_EXPIRES_MINUTES = 10;

function env(name, fallback = '') {
  const v = process.env[name];
  return v != null ? String(v).trim() : fallback;
}

/** Prefer SMTP_*; fall back to EMAIL_* aliases. */
function envFirst(names, fallback = '') {
  for (const n of names) {
    const v = env(n);
    if (v) return v;
  }
  return fallback;
}

function getSmtpConfig() {
  const host = envFirst(['SMTP_HOST', 'EMAIL_HOST']);
  const portRaw = envFirst(['SMTP_PORT', 'EMAIL_PORT'], '587');
  const port = Number(portRaw);
  const user = envFirst(['SMTP_USER', 'EMAIL_USER']);
  const pass = envFirst(['SMTP_PASS', 'EMAIL_PASS']);
  const secure = envFirst(['SMTP_SECURE', 'EMAIL_SECURE']).toLowerCase() === 'true';
  const from = envFirst(['MAIL_FROM', 'EMAIL_FROM', 'SMTP_USER', 'EMAIL_USER']);
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
    secure,
    from,
  };
}

let cachedTransport = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  return cachedTransport;
}

function getMailFrom() {
  return getSmtpConfig().from;
}

function logSmtpConfigStatus() {
  const cfg = getSmtpConfig();
  if (!cfg.host) {
    console.warn('[email] SMTP_HOST (or EMAIL_HOST): missing');
  } else {
    console.log(`[email] SMTP_HOST (or EMAIL_HOST): ${cfg.host}`);
  }
  if (!cfg.user) {
    console.warn('[email] SMTP_USER (or EMAIL_USER): missing');
  } else {
    console.log(`[email] SMTP_USER (or EMAIL_USER): ${cfg.user}`);
  }
  if (!cfg.pass) {
    console.warn('[email] SMTP_PASS (or EMAIL_PASS): missing');
  } else {
    console.log('[email] SMTP_PASS (or EMAIL_PASS): loaded');
  }
  console.log(`[email] SMTP_PORT (or EMAIL_PORT): ${cfg.port}`);
  console.log(`[email] SMTP_SECURE: ${cfg.secure}`);
  if (cfg.from) {
    console.log(`[email] MAIL_FROM (or EMAIL_FROM): ${cfg.from}`);
  } else {
    console.warn('[email] MAIL_FROM (or EMAIL_FROM): missing');
  }
}

async function verifySmtpOnStartup() {
  logSmtpConfigStatus();
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    console.warn('[email] OTP email disabled/misconfigured.');
    return { ok: false, reason: 'missing_config' };
  }

  const transport = getTransport();
  if (!transport) {
    console.warn('[email] OTP email disabled/misconfigured.');
    return { ok: false, reason: 'no_transport' };
  }

  try {
    await transport.verify();
    console.log('[email] SMTP transporter.verify() succeeded');
    return { ok: true };
  } catch (err) {
    console.warn(`[email] OTP email disabled/misconfigured. ${err.message}`);
    return { ok: false, reason: 'verify_failed', error: err };
  }
}

function failOtpSend(err, to, otp) {
  const msg = err && err.message ? err.message : String(err || 'unknown error');
  console.error(`[email] sendMail failure: ${msg}`);
  if (process.env.NODE_ENV !== 'production' && otp && to) {
    console.log(`[DEV OTP] ${String(to).trim().toLowerCase()}: ${otp}`);
  }
  const wrapped = new Error(OTP_EMAIL_FAIL_MESSAGE);
  wrapped.code = 'OTP_EMAIL_SEND_FAILED';
  wrapped.cause = err;
  throw wrapped;
}

/**
 * Send OTP email — throws on any failure (never report success unless sendMail succeeds).
 * @param {{ to: string; otp: string; purpose?: string; name?: string; expiresMinutes?: number }} opts
 */
async function sendOtpMail({ to, otp, purpose = 'verification', name = '', expiresMinutes = DEFAULT_OTP_EXPIRES_MINUTES }) {
  const recipient = String(to || '').trim().toLowerCase();
  const code = String(otp || '').trim();
  const purposeLabel = String(purpose || 'verification').trim() || 'verification';

  console.log(`[email] Attempting OTP email send to=${recipient} purpose=${purposeLabel}`);

  const transport = getTransport();
  if (!transport) {
    failOtpSend(new Error('smtp_not_configured'), recipient, code);
  }

  const from = getMailFrom();
  if (!from) {
    failOtpSend(new Error('mail_from_not_configured'), recipient, code);
  }

  const tpl = makeOtpEmail({
    name: String(name || '').trim(),
    otp: code,
    expiresMinutes,
  });

  try {
    const info = await transport.sendMail({
      from,
      to: recipient,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    console.log(`[email] sendMail success messageId=${info.messageId || '(none)'}`);
    return info;
  } catch (err) {
    failOtpSend(err, recipient, code);
  }
}

/** Non-critical mail (e.g. welcome) — failures are logged, not thrown. */
async function sendMailSafe(message) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[email] sendMailSafe skipped: SMTP not configured');
    return { ok: false, reason: 'smtp_not_configured' };
  }

  const to = String(message.to || '').trim();
  console.log(`[email] Sending mail to ${to || '(unknown)'}`);

  try {
    const info = await transport.sendMail(message);
    console.log(`[email] sendMail success messageId=${info.messageId || '(none)'}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[email] sendMail failure: ${err.message}`);
    return { ok: false, reason: 'send_failed', error: err };
  }
}

module.exports = {
  OTP_EMAIL_FAIL_MESSAGE,
  getMailFrom,
  getSmtpConfig,
  sendOtpMail,
  sendMailSafe,
  verifySmtpOnStartup,
};
