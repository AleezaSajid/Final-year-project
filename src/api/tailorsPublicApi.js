import { getApiBaseUrl } from "./client.js";

/**
 * @returns {Promise<{ tailors: object[], ok: boolean }>}
 */
export async function fetchPublicTailors() {
  const base = getApiBaseUrl();
  if (!base) {
    return { tailors: [], ok: false };
  }
  try {
    const res = await fetch(`${base}/api/tailors/public`);
    if (!res.ok) {
      return { tailors: [], ok: false };
    }
    const data = await res.json();
    const tailors = Array.isArray(data.tailors) ? data.tailors : [];
    return { tailors, ok: true };
  } catch {
    return { tailors: [], ok: false };
  }
}

/**
 * @param {string} idOrShopId — Mongo id or tailorShopId (e.g. T-U5)
 * @returns {Promise<{ tailor: object | null, ok: boolean }>}
 */
export async function fetchPublicTailorById(idOrShopId) {
  const raw = idOrShopId != null ? String(idOrShopId).trim() : "";
  if (!raw) {
    return { tailor: null, ok: false };
  }
  const base = getApiBaseUrl();
  if (!base) {
    return { tailor: null, ok: false };
  }
  try {
    const enc = encodeURIComponent(raw);
    const res = await fetch(`${base}/api/tailors/public/${enc}`);
    if (res.status === 404) {
      return { tailor: null, ok: true };
    }
    if (!res.ok) {
      return { tailor: null, ok: false };
    }
    const data = await res.json();
    const tailor = data.tailor && typeof data.tailor === "object" ? data.tailor : null;
    return { tailor, ok: true };
  } catch {
    return { tailor: null, ok: false };
  }
}
