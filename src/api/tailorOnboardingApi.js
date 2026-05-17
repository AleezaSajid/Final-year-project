import { api, getApiBaseUrl } from "./client.js";

export async function getTailorOnboardingProfile() {
  return api("/api/tailor/onboarding-profile");
}

export async function completeTailorProfile(formData) {
  const res = await fetch(`${getApiBaseUrl()}/api/tailor/complete-profile`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || "Could not save profile.");
    err.status = res.status;
    throw err;
  }
  return data;
}
