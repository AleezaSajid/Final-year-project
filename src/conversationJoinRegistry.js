import { normalizeConversationId } from "./chatUtils.js";

const joined = new Set();

export function notifyConversationRoomJoined(rawId) {
  const n = normalizeConversationId(rawId);
  if (n) joined.add(n);
}

export function notifyConversationRoomLeft(rawId) {
  const n = normalizeConversationId(rawId);
  if (n) joined.delete(n);
}

export function clearConversationJoinRegistry() {
  joined.clear();
}

export function isConversationRoomJoined(rawId) {
  const n = normalizeConversationId(rawId);
  return n ? joined.has(n) : false;
}
