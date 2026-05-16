import { isPlaceholderTailorShopId, looksLikeTailorShopId } from "./utils/chatIdentity.js";

const DEFAULT_TAILOR_FOR_PAIR = "order-peer";

/**
 * Deterministic id for the 1:1 room (both ids required; no duplicate self-pair).
 * Legacy `filter(Boolean)` dropped "" and produced wrong rooms; duplicate ids produced "3-3".
 */
export const getConversationId = (userA, userB) => {
  const a = String(userA ?? "")
    .trim();
  const b = String(userB ?? "")
    .trim();
  if (!a || !b) return "";
  if (a === b) {
    return [DEFAULT_TAILOR_FOR_PAIR, a]
      .sort()
      .join("-");
  }
  return [a, b]
    .sort()
    .join("-");
};

/** Private chat room id for an accepted order (plain Mongo order id; matches `Conversation.orderId`). */
export function getOrderChatConversationId(orderId) {
  return normalizeConversationId(orderId);
}

/** Strip legacy `order_` prefix from stored message `conversationId` values. */
export function canonicalOrderIdFromChatConversationId(conversationId) {
  const raw = conversationId != null ? String(conversationId).trim() : "";
  if (!raw) return "";
  if (raw.startsWith("order_")) return raw.slice("order_".length).trim();
  return raw;
}

/**
 * Single canonical order id for conversations, socket rooms, and state keys.
 * `order_abc` → `abc`; plain ids unchanged.
 */
export function normalizeConversationId(id) {
  return canonicalOrderIdFromChatConversationId(normalizeChatId(id));
}

/** True if a message belongs to this order’s chat (canonical id or legacy `order_${id}`). */
export function messageBelongsToOrderChat(message, orderIdCanonical) {
  const mid = normalizeConversationId(message?.conversationId);
  const want = normalizeConversationId(orderIdCanonical);
  if (!mid || !want) return false;
  if (mid === want) return true;
  if (normalizeChatId(message?.conversationId) === `order_${want}`) return true;
  return false;
}

/** Prefer a human-readable label; never show internal shop/user ids in chat UI. */
export function displayChatActorName(...candidates) {
  for (const c of candidates) {
    const s = c != null ? String(c).trim() : "";
    if (!s) continue;
    if (/^T-[A-Z0-9-]+$/i.test(s)) continue;
    if (/^SCH-/i.test(s)) continue;
    if (/^CU-\d+$/i.test(s)) continue;
    if (/^\d+$/.test(s)) continue;
    return s;
  }
  return "";
}

/**
 * True when tailor must accept before chat (customer selected tailor, not yet accepted).
 */
export function isOrderAwaitingTailorAccept(order) {
  if (!order || typeof order !== "object") return false;
  if (order.isActive === true || order.acceptedAt) return false;
  const raw = order.status ?? order.workflowStatus ?? "";
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "accepted" || s === "active") return false;
  if (s === "awaiting_tailor_selection" || s === "draft") return false;
  return s === "pending" || s === "awaiting_acceptance" || s === "order_placed";
}

/**
 * Per-order chat unlock (matches backend `isOrderDocChatEnabled`).
 * @param {object} order
 * @param {{ conversationStatus?: string }} [options]
 */
export function isOrderChatEnabled(order, options = {}) {
  if (!order || typeof order !== "object") return false;
  const convSt =
    options.conversationStatus != null
      ? String(options.conversationStatus).trim().toLowerCase().replace(/\s+/g, "_")
      : "";
  if (convSt === "accepted") return true;
  const tid = order.tailorId != null ? String(order.tailorId).trim() : "";
  if (!tid || isPlaceholderTailorShopId(tid)) return false;
  const raw = order.status ?? order.workflowStatus ?? "";
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (["rejected", "declined", "cancelled", "canceled"].includes(s)) return false;
  if (order.isActive === true || order.acceptedAt) return true;
  if (order.chatEnabled === false) return false;
  if (s === "awaiting_tailor_selection" || s === "draft") return false;
  return s === "accepted" || s === "active";
}

/**
 * @param {object} order
 * @param {{ allowLegacyPlaceholderTailor?: boolean }} [options] — when true, still allow chat for legacy rows
 *   whose `tailorId` is a demo shop id (e.g. T-A1). Order creation APIs remain strict elsewhere.
 */
export function isOrderEligibleForChat(order, options = {}) {
  if (!order || typeof order !== "object") return false;
  const allowLegacy = Boolean(options.allowLegacyPlaceholderTailor);
  const tid = order.tailorId != null ? String(order.tailorId).trim() : "";
  if (!tid) return false;
  const tailorOk = looksLikeTailorShopId(tid) || (allowLegacy && isPlaceholderTailorShopId(tid));
  if (!tailorOk) return false;
  return isOrderChatEnabled(order);
}

/** Keeps customer chat `customerId` aligned with `order.customerId` (tailor uses the same field). */
export const CHAT_ROOM_CUSTOMER_SYNC_EVENT = "sewserve:chat-room-customer-sync";
export const CHAT_ROOM_CUSTOMER_SESSION_KEY = "sewserve_chat_room_customer_id";

/** Bumps {@link CustomerChatContext} when order-derived tailor id is written to localStorage. */
export const CHAT_IDS_FROM_ORDER_EVENT = "sewserve:chat-ids-from-order";

export function readChatRoomCustomerIdFromStorage() {
  try {
    const v = sessionStorage.getItem(CHAT_ROOM_CUSTOMER_SESSION_KEY);
    if (v && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  return null;
}

export function publishChatRoomCustomerId(customerId) {
  const id = customerId != null ? String(customerId).trim() : "";
  if (!id) return;
  try {
    sessionStorage.setItem(CHAT_ROOM_CUSTOMER_SESSION_KEY, id);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHAT_ROOM_CUSTOMER_SYNC_EVENT, { detail: { customerId: id } }));
  }
}

export function notifyChatIdsFromOrderUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHAT_IDS_FROM_ORDER_EVENT));
  }
}

/** Socket.IO rooms and message ids must be strings: number `3` !== `"3"`. */
export function normalizeChatId(v) {
  if (v == null) return "";
  return String(v).trim();
}

/** Log malformed conversation rows (does not throw). */
export function logConversationRowsValidation(rows, label) {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const r = list[i];
    if (!r || typeof r !== "object") {
      console.warn("[ChatSync Validation]", label, "malformed row at index", i, r);
      continue;
    }
    const oid = normalizeConversationId(r.orderId ?? r.conversationId);
    if (!oid) console.warn("[ChatSync Validation]", label, "missing orderId/conversationId", r);
    const tid = normalizeChatId(r.tailorId);
    const cid = normalizeChatId(r.customerId);
    if (!tid) console.warn("[ChatSync Validation]", label, "missing tailorId", r);
    if (!cid) console.warn("[ChatSync Validation]", label, "missing customerId", r);
    if (oid && seen.has(oid)) console.warn("[ChatSync Validation]", label, "duplicate conversationId", oid);
    if (oid) seen.add(oid);
  }
}

/** Dedupe by normalized order id; keeps first occurrence. */
export function dedupeConversationsByOrderId(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const oid = normalizeConversationId(r?.orderId ?? r?.conversationId);
    if (!oid || seen.has(oid)) continue;
    seen.add(oid);
    out.push(r);
  }
  return out;
}

/** Payload the server and clients both understand (string ids only). */
export function buildOutgoingChatMessage({ senderId, receiverId, conversationId, content, status }) {
  return {
    senderId: normalizeChatId(senderId),
    receiverId: normalizeChatId(receiverId),
    conversationId: normalizeConversationId(conversationId),
    content: String(content || "").trim(),
    timestamp: new Date().toISOString(),
    status: status || "sent",
  };
}
