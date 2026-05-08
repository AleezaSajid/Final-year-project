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
    // Prefer new endpoint, fall back to legacy `/api/tailors/public`.
    const tryPaths = [`${base}/api/tailors`, `${base}/api/tailors/public`];
    for (const url of tryPaths) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const tailors = Array.isArray(data.tailors) ? data.tailors : [];
      return { tailors, ok: true };
    }
    return { tailors: [], ok: false };
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

/**
 * Geospatial nearby query (backend uses 2dsphere + $geoNear).
 * @param {{ lat: number, lng: number, radiusKm?: number }} params
 * @returns {Promise<{ tailors: object[], ok: boolean }>}
 */
export async function fetchNearbyTailors(params) {
  const lat = params && typeof params.lat === "number" ? params.lat : NaN;
  const lng = params && typeof params.lng === "number" ? params.lng : NaN;
  const radiusKm =
    params && typeof params.radiusKm === "number" && params.radiusKm > 0 ? params.radiusKm : 5;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { tailors: [], ok: false };
  const base = getApiBaseUrl();
  if (!base) return { tailors: [], ok: false };
  try {
    const url = `${base}/api/tailors/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
      String(lng)
    )}&radiusKm=${encodeURIComponent(String(radiusKm))}`;
    const res = await fetch(url);
    if (!res.ok) return { tailors: [], ok: false };
    const data = await res.json();
    const tailors = Array.isArray(data.tailors) ? data.tailors : [];
    return { tailors, ok: true };
  } catch {
    return { tailors: [], ok: false };
  }
}
