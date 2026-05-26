import { isStaleLatLng } from "./locationSafety.js";

/** Placeholder coords stored at signup until complete-profile. */
export function isTailorPendingLocation(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return true;
  if (isStaleLatLng(lat, lng)) return true;
  return false;
}

/** Where a tailor should land after auth (login, signup, OTP). */
export function tailorPostAuthPath(user) {
  if (!user || String(user.role || "").trim() !== "tailor") {
    return "/tailor/dashboard";
  }
  if (user.profileComplete === false) {
    return "/tailor/complete-profile";
  }
  return "/tailor/dashboard";
}

export function isTailorProfileIncomplete(user) {
  return (
    user &&
    String(user.role || "").trim() === "tailor" &&
    user.profileComplete === false
  );
}
