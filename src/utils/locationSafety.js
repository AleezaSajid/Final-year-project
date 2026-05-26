/** Known stale Lahore / default coordinates — never prefill, restore, or save. */
export const STALE_COORD_PAIRS = [
  [31.5826, 74.3276],
  [31.5204, 74.3587],
];

export const FRESH_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

const BASE_LOCATION_STORAGE_KEYS = [
  "userLocation",
  "sewserve_map_last_request",
  "sewserve_location_step_manual_address",
  "sewserve_tailor_manual_address",
];

export function normalizeLocationText(v) {
  return String(v ?? "").trim();
}

export function isStaleLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return STALE_COORD_PAIRS.some(
    ([slat, slng]) => Math.abs(lat - slat) < 0.001 && Math.abs(lng - slng) < 0.001
  );
}

export function isStaleAddressText(address) {
  const a = normalizeLocationText(address).toLowerCase();
  if (!a) return false;
  if (a.includes("kattra neem wala")) return true;
  if (a.includes("kattra") && a.includes("neem wala")) return true;
  return false;
}

export function isStaleLocationRecord(record) {
  if (!record) return false;
  if (typeof record === "string") {
    return isStaleAddressText(record);
  }
  if (typeof record !== "object" || Array.isArray(record)) return false;
  const lat = record.lat != null ? Number(record.lat) : NaN;
  const lng = record.lng != null ? Number(record.lng) : NaN;
  if (isStaleLatLng(lat, lng)) return true;
  if (isStaleAddressText(record.address)) return true;
  return false;
}

export function isTrustworthyProfileCoords(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && !isStaleLatLng(lat, lng);
}

function tryParseStorageJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Remove client caches that contain stale/default Lahore location data. */
export function purgeStaleLocationStorage(extraKeys = []) {
  if (typeof window === "undefined") return;
  const keysToCheck = [...BASE_LOCATION_STORAGE_KEYS, ...extraKeys];
  const stores = [localStorage, sessionStorage];
  for (const store of stores) {
    if (!store) continue;
    try {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k) keys.push(k);
      }
      for (const key of keys) {
        const lower = key.toLowerCase();
        const isLocationKey =
          keysToCheck.includes(key) ||
          lower.includes("location") ||
          lower.includes("userlocation") ||
          lower.includes("lastknown");
        if (!isLocationKey) continue;
        const raw = store.getItem(key);
        const parsed = tryParseStorageJson(raw);
        if (parsed == null) continue;
        if (isStaleLocationRecord(parsed)) {
          store.removeItem(key);
          continue;
        }
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          if (parsed.lat != null || parsed.lng != null || parsed.address != null) {
            if (isStaleLocationRecord(parsed)) store.removeItem(key);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  for (const key of keysToCheck) {
    try {
      const raw =
        localStorage.getItem(key) ??
        (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null);
      if (raw != null && isStaleLocationRecord(tryParseStorageJson(raw))) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
}

export function geolocationErrorMessage(geoErr, { manualHint = "enter your address manually below" } = {}) {
  const code = geoErr && geoErr.code;
  if (code === 1) {
    return `Location permission denied. Allow location access in your browser settings, or ${manualHint}.`;
  }
  if (code === 2) {
    return `Location unavailable. Check that location services are on, or ${manualHint}.`;
  }
  if (code === 3) {
    return `Location request timed out after 15 seconds. Try again or ${manualHint}.`;
  }
  return `Could not get your current location. Try again or ${manualHint}.`;
}
