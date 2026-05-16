import {
  displayChatActorName,
  isOrderChatEnabled,
  normalizeChatId,
  normalizeConversationId,
} from "../chatUtils.js";

/** Expected peer id for a message given order participants. */
export function resolveExpectedReceiverId(senderId, customerId, tailorId) {
  const s = normalizeChatId(senderId);
  const c = normalizeChatId(customerId);
  const t = normalizeChatId(tailorId);
  if (!s || !c || !t) return "";
  if (s === c) return t;
  if (s === t) return c;
  return "";
}

/** Normalize participant ids from a conversation row or order stub. */
export function participantsFromRow(row) {
  if (!row || typeof row !== "object") {
    return { conversationId: "", orderId: "", customerId: "", tailorId: "" };
  }
  const conversationId = normalizeConversationId(row.orderId ?? row.conversationId);
  return {
    conversationId,
    orderId: conversationId,
    customerId: normalizeChatId(row.customerId),
    tailorId: normalizeChatId(row.tailorId),
  };
}

/**
 * Per-order send/join identity from the active sidebar row (not global tailor session).
 * @param {'customer'|'tailor'} mode
 */
export function resolveConversationPeers({ row, currentUserId, mode = "customer" }) {
  const { conversationId, orderId, customerId, tailorId } = participantsFromRow(row);
  const me = normalizeChatId(currentUserId);
  if (!conversationId || !me || !customerId || !tailorId) {
    return {
      conversationId,
      orderId,
      customerId,
      tailorId,
      senderId: "",
      receiverId: "",
      peerDisplayName: "",
    };
  }

  const receiverId = resolveExpectedReceiverId(me, customerId, tailorId);

  const peerDisplayName =
    mode === "customer"
      ? displayChatActorName(row?.tailorName, row?.tailorShopName) || "Your tailor"
      : displayChatActorName(row?.customerName, row?.customerId) || "Customer";

  return {
    conversationId,
    orderId,
    customerId,
    tailorId,
    senderId: me,
    receiverId,
    peerDisplayName,
    isChatEnabled: isOrderChatEnabled(row),
  };
}

/** True if a conversation list row or order-like object allows messaging (order fields on row). */
export function isRowChatEnabled(row) {
  return isOrderChatEnabled(row || {});
}

/** Infer peer tailor/customer id from a message + logged-in user. */
export function inferPeerIdFromMessage(message, loggedInUserId) {
  const me = normalizeChatId(loggedInUserId);
  const sender = normalizeChatId(message?.senderId);
  const receiver = normalizeChatId(message?.receiverId);
  if (!me) return "";
  if (sender === me) return receiver;
  if (receiver === me) return sender;
  if (sender && sender !== me) return sender;
  if (receiver && receiver !== me) return receiver;
  return "";
}
