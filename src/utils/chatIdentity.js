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
 * Real tailor shop id for socket rooms and order ownership — never demo placeholders.
 * @param {object | null | undefined} user
 */
export function resolveLoggedInTailorShopId(user) {
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
  return "";
}

/**
 * Tailor id when acting as tailor: real shop id first; demo default only for non-tailor legacy flows.
 * @param {object | null | undefined} user
 */
export function resolveTailorIdWhenViewingAsTailor(user) {
  const resolved = resolveLoggedInTailorShopId(user);
  if (resolved) return resolved;
  if (user?.role === "tailor") return "";
  return DEFAULT_TAILOR_CHAT_ID;
}

/**
 * Resolve tailorShopId from a public tailor card/API row (never Mongo card id or display name).
 * @param {object | null | undefined} tailor
 */
export function resolveTailorShopIdFromPublicTailor(tailor) {
  if (!tailor || typeof tailor !== "object") return "";
  const shop = tailor.tailorShopId != null ? String(tailor.tailorShopId).trim() : "";
  if (looksLikeTailorShopId(shop)) return shop;
  const alt = tailor.shopId != null ? String(tailor.shopId).trim() : "";
  if (looksLikeTailorShopId(alt)) return alt;
  const id = tailor.id != null ? String(tailor.id).trim() : "";
  if (looksLikeTailorShopId(id)) return id;
  return "";
}

/**
 * Generic demo shop ids (T-A1, T-A2, …) — must not be used for order linkage, conversations, or chat routing.
 */
export function isPlaceholderTailorShopId(value) {
  const s = String(value ?? "").trim();
  if (!s) return true;
  return /^T-A\d+$/i.test(s);
}

/**
 * True when value looks like a real persisted tailor shop id (e.g. T-U17, SCH-…).
 * Excludes T-A* placeholders and non-shop values (e.g. numeric user ids).
 */
export function looksLikeTailorShopId(value) {
  const s = String(value ?? "").trim();
  if (!s) return false;
  if (isPlaceholderTailorShopId(s)) return false;
  if (/^T-[A-Z0-9-]+$/i.test(s)) return true;
  if (/^SCH-/i.test(s)) return true;
  return false;
}

/**
 * Tailor shop id for customer-side orders/chat: session hint or user-assigned shop only — never a demo placeholder.
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
  return "";
}

/** Persist resolved tailor id so customer chat uses the same shop id on this device. */
export function syncTailorSessionFromTailorUser(user) {
  const id = resolveLoggedInTailorShopId(user);
  if (!id) return "";
  try {
    localStorage.setItem(TAILOR_SESSION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/** Persist a real customer-selected / order-linked shop id for wizard + chat session hint. */
export function persistCustomerTailorShopSession(shopId) {
  const s = shopId != null ? String(shopId).trim() : "";
  if (!looksLikeTailorShopId(s)) return false;
  try {
    localStorage.setItem(TAILOR_SESSION_STORAGE_KEY, s);
    return true;
  } catch {
    return false;
  }
}

/** Clear stale tailor session when starting a new wizard order. */
export function clearCustomerTailorShopSession() {
  try {
    localStorage.removeItem(TAILOR_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
