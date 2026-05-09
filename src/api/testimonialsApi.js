import { api, getApiBaseUrl } from "./client.js";

export async function fetchTestimonials() {
  try {
    const data = await api("/api/testimonials");
    return Array.isArray(data.testimonials) ? data.testimonials : [];
  } catch {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/testimonials`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.testimonials) ? data.testimonials : [];
    } catch {
      return [];
    }
  }
}

export async function createTestimonial(body) {
  return api("/api/testimonials", { method: "POST", json: body });
}
