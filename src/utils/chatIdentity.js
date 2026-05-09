/**
 * Single source of truth for chat-related user ids (auth → localStorage → safe defaults).
 * Do not import dashboard `tailorId` constants here; defaults live only in this module.
 */

export const TAILOR_SESSION_STORAGE_KEY = "sewserve_tailor_session_id";
export const CUSTOMER_ID_STORAGE_KEY = "sewserve_customer_id";

/** Matches legacy demo orders / wizard when no better id exists. */
export const DEFAULT_TAILOR_CHAT_ID = "T-A1";
export const DEFAULT_CUSTOMER_CHAT_ID = "CU-001";

/**
 * Customer id for chat and customer-side APIs: auth first, then optional stored id.
 * @param {object | null | undefined} user
 */
export function resolveCustomerIdForChat(user) {
  if (user && typeof user === "object") {
    const id = user.customerId ?? user.id ?? user._id;
    if (id != null && String(id).trim() !== "") return String(id).trim();
  }
  try {
    const stored = localStorage.getItem(CUSTOMER_ID_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    /* ignore */
  }
  return DEFAULT_CUSTOMER_CHAT_ID;
}

/**
 * Tailor id when acting as tailor: auth first, then persisted session, then default.
 * @param {object | null | undefined} user
 */
export function resolveTailorIdWhenViewingAsTailor(user) {
  if (user && typeof user === "object") {
    const shop = user.tailorShopId != null ? String(user.tailorShopId).trim() : "";
    if (shop && looksLikeTailorShopId(shop)) return shop;
    const tid = user.tailorId != null ? String(user.tailorId).trim() : "";
    if (tid && looksLikeTailorShopId(tid)) return tid;
  }
  try {
    const stored = localStorage.getItem(TAILOR_SESSION_STORAGE_KEY);
    if (stored && stored.trim() && looksLikeTailorShopId(stored)) return stored.trim();
  } catch {
    /* ignore */
  }
  return DEFAULT_TAILOR_CHAT_ID;
}

/**
 * Reject values that are clearly not a tailor shop id (e.g. numeric user ids written by mistake).
 * Prevents "3" as tailor + "3" as customer -> broken room "3-3".
 */
export function looksLikeTailorShopId(value) {
  const s = String(value ?? "").trim();
  if (!s) return false;
  if (/^T-[A-Z0-9-]+$/i.test(s)) return true;
  if (/^SCH-/i.test(s)) return true;
  return false;
}

/**
 * Tailor shop id for customer-side chat: same-session tailor id, then optional user hints, then default.
 * @param {object | null | undefined} user
 */
export function resolveTailorIdForCustomerChat(user) {
  try {
    const stored = localStorage.getItem(TAILOR_SESSION_STORAGE_KEY);
    if (stored && looksLikeTailorShopId(stored)) return stored.trim();
  } catch {
    /* ignore */
  }
  if (user && typeof user === "object") {
    const id = user.assignedTailorId ?? user.tailorShopId ?? user.tailorId;
    if (id != null && String(id).trim() !== "" && looksLikeTailorShopId(String(id).trim())) {
      return String(id).trim();
    }
  }
  return DEFAULT_TAILOR_CHAT_ID;
}

/** Persist resolved tailor id so customer chat uses the same shop id on this device. */
export function syncTailorSessionFromTailorUser(user) {
  const id = resolveTailorIdWhenViewingAsTailor(user);
  try {
    localStorage.setItem(TAILOR_SESSION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}
