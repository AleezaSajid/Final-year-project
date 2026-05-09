import { api } from "./client.js";

export function sendAuthOtp(email) {
  return api("/api/auth/send-otp", {
    method: "POST",
    json: { email: String(email || "").trim().toLowerCase() },
  });
}

export function verifyAuthOtp(email, otp) {
  const digits = String(otp || "").replace(/\D/g, "");
  return api("/api/auth/verify-otp", {
    method: "POST",
    json: {
      email: String(email || "").trim().toLowerCase(),
      otp: digits,
    },
  });
}
