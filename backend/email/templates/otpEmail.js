/**
 * @param {{ name?: string; otp: string; expiresMinutes?: number }} opts
 */
function makeOtpEmail({ name, otp, expiresMinutes = 10 }) {
  const who = name && String(name).trim() ? String(name).trim() : 'there';
  const code = String(otp || '').trim();
  const subject = 'Your Verification Code';
  const text = [
    `Hi ${who},`,
    '',
    `Your SewServe verification code is: ${code}`,
    '',
    `This code expires in ${expiresMinutes} minutes.`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f8;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px 24px;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
        <tr><td style="font-size:18px;font-weight:700;color:#0f172a;">Your verification code</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#475569;">Hi ${who}, use this code to verify your email and activate your account:</td></tr>
        <tr><td style="padding-top:20px;padding-bottom:8px;" align="center">
          <div style="display:inline-block;letter-spacing:0.35em;font-size:26px;font-weight:800;color:#0f172a;padding:14px 22px;background:#f1f5f9;border-radius:10px;">${code}</div>
        </td></tr>
        <tr><td style="font-size:14px;line-height:1.5;color:#64748b;">This code expires in <strong>${expiresMinutes} minutes</strong>.</td></tr>
        <tr><td style="padding-top:20px;font-size:13px;color:#94a3b8;">If you did not request this, you can ignore this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

module.exports = { makeOtpEmail };
