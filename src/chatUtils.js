const DEFAULT_TAILOR_FOR_PAIR = "T-A1";

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

/** Private chat room id for an accepted order (matches persisted `Message.conversationId`). */
export function getOrderChatConversationId(orderId) {
  const id = orderId != null ? String(orderId).trim() : "";
  if (!id) return "";
  return `order_${id}`;
}

export function isOrderEligibleForChat(order) {
  if (!order || typeof order !== "object") return false;
  const tid = order.tailorId != null ? String(order.tailorId).trim() : "";
  if (!tid) return false;
  const raw = order.status ?? order.workflowStatus ?? "";
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (["rejected", "declined", "cancelled", "canceled"].includes(s)) return false;
  if (s === "order_placed") return false;
  return true;
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

/** Payload the server and clients both understand (string ids only). */
export function buildOutgoingChatMessage({ senderId, receiverId, conversationId, content, status }) {
  return {
    senderId: normalizeChatId(senderId),
    receiverId: normalizeChatId(receiverId),
    conversationId: normalizeChatId(conversationId),
    content: String(content || "").trim(),
    timestamp: new Date().toISOString(),
    status: status || "sent",
  };
}
