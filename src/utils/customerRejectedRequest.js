import { resolveTailorShopIdFromPublicTailor } from "./chatIdentity.js";

const REJECTED_TAILORS_KEY_PREFIX = "sewserve_rejected_tailors_";
const DISMISSED_NOTICE_KEY_PREFIX = "sewserve_decline_dismissed_";

function readSessionJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeSessionJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function rejectedTailorsKey(orderId) {
  return `${REJECTED_TAILORS_KEY_PREFIX}${String(orderId || "").trim()}`;
}

function dismissedNoticeKey(orderId, tailorId = "") {
  const oid = String(orderId || "").trim();
  const tid = String(tailorId || "").trim();
  if (tid) return `${DISMISSED_NOTICE_KEY_PREFIX}${oid}__${tid}`;
  return `${DISMISSED_NOTICE_KEY_PREFIX}${oid}`;
}

export function clearCustomerRejectedRequestSession() {
  if (typeof window === "undefined") return;
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (
        k &&
        (k.startsWith(REJECTED_TAILORS_KEY_PREFIX) || k.startsWith(DISMISSED_NOTICE_KEY_PREFIX))
      ) {
        keys.push(k);
      }
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function readRejectedTailorIdsForRequest(orderId) {
  const oid = String(orderId || "").trim();
  if (!oid) return new Set();
  const list = readSessionJson(rejectedTailorsKey(oid), []);
  return new Set((Array.isArray(list) ? list : []).map((id) => String(id).trim()).filter(Boolean));
}

export function addRejectedTailorIdForRequest(orderId, tailorId) {
  const oid = String(orderId || "").trim();
  const tid = String(tailorId || "").trim();
  if (!oid || !tid) return readRejectedTailorIdsForRequest(oid);
  const set = readRejectedTailorIdsForRequest(oid);
  set.add(tid);
  writeSessionJson(rejectedTailorsKey(oid), [...set]);
  return set;
}

/** True when user dismissed the decline modal for this order + rejected tailor. */
export function isDeclineNoticeDismissedForRequest(orderId, tailorId = "") {
  const oid = String(orderId || "").trim();
  const tid = String(tailorId || "").trim();
  if (!oid) return false;
  if (tid) {
    return readSessionJson(dismissedNoticeKey(oid, tid), false) === true;
  }
  return readSessionJson(dismissedNoticeKey(oid), false) === true;
}

export function isDeclineNoticeDismissedForRejection(notice) {
  if (!notice || typeof notice !== "object") return false;
  return isDeclineNoticeDismissedForRequest(notice.orderId, notice.tailorId);
}

export function markDeclineNoticeDismissedForRequest(orderId, tailorId = "") {
  const oid = String(orderId || "").trim();
  const tid = String(tailorId || "").trim();
  if (!oid) return;
  if (tid) {
    writeSessionJson(dismissedNoticeKey(oid, tid), true);
    return;
  }
  writeSessionJson(dismissedNoticeKey(oid), true);
}

export function clearDeclineNoticeDismissedForRequest(orderId, tailorId = "") {
  const oid = String(orderId || "").trim();
  const tid = String(tailorId || "").trim();
  if (!oid) return;
  writeSessionJson(dismissedNoticeKey(oid), null);
  if (tid) writeSessionJson(dismissedNoticeKey(oid, tid), null);
}

/** Match public tailor card / map row against hidden tailor shop ids for this request. */
export function isPublicTailorHiddenForRejectedRequest(tailor, rejectedTailorIds) {
  if (!tailor || typeof tailor !== "object") return false;
  const hidden =
    rejectedTailorIds instanceof Set
      ? rejectedTailorIds
      : new Set(Array.isArray(rejectedTailorIds) ? rejectedTailorIds : []);
  if (!hidden.size) return false;

  const shop = resolveTailorShopIdFromPublicTailor(tailor);
  if (shop && hidden.has(shop)) return true;

  for (const key of ["tailorShopId", "shopId", "id", "_id"]) {
    const v = tailor[key] != null ? String(tailor[key]).trim() : "";
    if (v && hidden.has(v)) return true;
  }
  return false;
}

/** Persist hidden tailor for this request only (does not reset dismiss state). */
export function persistDeclinedNoticeForRequest(notice) {
  if (!notice || typeof notice !== "object") return;
  const oid = String(notice.orderId || "").trim();
  const tid = String(notice.tailorId || "").trim();
  if (oid && tid) addRejectedTailorIdForRequest(oid, tid);
}
