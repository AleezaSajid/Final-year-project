function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeWelcomeEmail({ name, appName, loginUrl, verifyUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeApp = escapeHtml(appName || 'SewServe');
  const safeLogin = escapeHtml(loginUrl || '');
  const safeVerify = escapeHtml(verifyUrl || '');

  const preheader = `Welcome to ${safeApp}. Your account is ready.`;

  const verifyBlock = safeVerify
    ? `
      <tr>
        <td style="padding: 0 28px 18px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:14px 14px;">
            <div style="font-weight:700;color:#065f46;margin:0 0 6px;">Verify your email (recommended)</div>
            <div style="color:#065f46;opacity:0.9;font-size:13px;line-height:1.55;">
              Click the button below to verify your email address.
            </div>
            <div style="height:12px;"></div>
            <a href="${safeVerify}" style="display:inline-block;background:linear-gradient(180deg,#4a7c59,#355542);color:#fff;text-decoration:none;font-weight:700;padding:10px 14px;border-radius:12px;font-size:14px;">
              Verify Email
            </a>
          </div>
        </td>
      </tr>
    `
    : '';

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeApp}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,0.7);box-shadow:0 18px 50px -24px rgba(15,23,42,0.35);background:linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,255,255,0.78));">
            <tr>
              <td style="padding:22px 24px;background:radial-gradient(120% 120% at 10% 0%, rgba(167,243,208,0.55), transparent 55%),radial-gradient(120% 120% at 95% 15%, rgba(186,230,253,0.55), transparent 52%),linear-gradient(180deg,#ffffff,rgba(255,255,255,0.65));">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:38px;height:38px;border-radius:14px;background:linear-gradient(180deg,#4a7c59,#355542);"></div>
                  <div>
                    <div style="font-weight:800;letter-spacing:-0.02em;font-size:18px;">${safeApp}</div>
                    <div style="font-size:12px;color:#475569;">Tailoring, made simple</div>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 28px 10px;">
                <h1 style="margin:0;font-size:20px;letter-spacing:-0.02em;">Welcome, ${safeName}</h1>
                <p style="margin:10px 0 0;color:#475569;line-height:1.6;font-size:14px;">
                  Your ${safeApp} account has been created successfully. You can now sign in and start using the app.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 28px 22px;">
                <a href="${safeLogin}" style="display:inline-block;background:linear-gradient(180deg,#4a7c59,#355542);color:#fff;text-decoration:none;font-weight:800;padding:12px 16px;border-radius:14px;font-size:14px;">
                  Sign in to ${safeApp}
                </a>
                <div style="height:10px;"></div>
                <div style="font-size:12px;color:#64748b;line-height:1.5;">
                  If the button doesn’t work, copy and paste this link:
                  <div style="word-break:break-all;color:#0f172a;">${safeLogin}</div>
                </div>
              </td>
            </tr>

            ${verifyBlock}

            <tr>
              <td style="padding: 18px 28px 24px;border-top:1px solid rgba(148,163,184,0.25);font-size:12px;color:#64748b;line-height:1.6;">
                You received this email because you signed up for ${safeApp}.
                <br />
                © ${new Date().getFullYear()} ${safeApp}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: `Welcome to ${appName || 'SewServe'}`,
    html,
    text: `Welcome, ${name || 'there'}!\n\nYour account has been created.\nSign in: ${loginUrl}\n${verifyUrl ? `Verify email: ${verifyUrl}\n` : ''}`,
  };
}

module.exports = { makeWelcomeEmail };

