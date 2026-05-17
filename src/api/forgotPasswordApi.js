import { api } from "./client.js";

/**
 * Request a password-reset OTP for a verified account.
 * Backend: POST /api/auth/forgot-password
 */
export function requestPasswordResetOtp(email) {
  return api("/api/auth/forgot-password", {
    method: "POST",
    json: { email: String(email || "").trim().toLowerCase() },
  });
}

/**
 * Verify reset OTP and set a new password.
 * Backend: POST /api/auth/verify-reset-otp
 */
export function verifyResetOtpAndSetPassword(email, otp, newPassword) {
  const digits = String(otp || "").replace(/\D/g, "");
  return api("/api/auth/verify-reset-otp", {
    method: "POST",
    json: {
      email: String(email || "").trim().toLowerCase(),
      otp: digits,
      newPassword: String(newPassword || ""),
    },
  });
}
