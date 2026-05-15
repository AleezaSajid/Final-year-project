import { dedupeConversationsByOrderId, normalizeConversationId } from "../../chatUtils.js";

/**
 * Sort conversation rows like dashboard hooks (newest activity first).
 * @param {unknown[]} rows
 * @returns {Record<string, unknown>[]}
 */
export function sortWorkspaceConversationsDesc(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => {
    const ta = new Date(a?.lastMessageAt || a?.updatedAt || 0).getTime();
    const tb = new Date(b?.lastMessageAt || b?.updatedAt || 0).getTime();
    return tb - ta;
  });
}

/**
 * Merges API-fetched rows with a synthetic row for the currently open order chat.
 * - Dedupes by normalized order id (API first, then injected fields merged under existing row).
 * - If no API row exists for the active id, prepends injected row.
 * @param {unknown[]|undefined|null} apiRows
 * @param {Record<string, unknown>|null|undefined} injectedRow
 */
export function mergeSidebarRowsWithInjected(apiRows, injectedRow) {
  const base = dedupeConversationsByOrderId(Array.isArray(apiRows) ? [...apiRows] : []);
  if (!injectedRow) {
    return sortWorkspaceConversationsDesc(base);
  }
  const oid = normalizeConversationId(injectedRow.orderId ?? injectedRow.conversationId);
  if (!oid) {
    return sortWorkspaceConversationsDesc(base);
  }
  const idx = base.findIndex((r) => normalizeConversationId(r?.orderId ?? r?.conversationId) === oid);
  if (idx >= 0) {
    const existing = base[idx];
    const nonEmpty = (v) => v != null && String(v).trim() !== "";
    const merged = {
      ...injectedRow,
      ...existing,
      orderId: oid,
      conversationId: oid,
      customerName: nonEmpty(existing.customerName) ? existing.customerName : injectedRow.customerName,
      customerId: nonEmpty(existing.customerId) ? existing.customerId : injectedRow.customerId,
      tailorName: nonEmpty(existing.tailorName) ? existing.tailorName : injectedRow.tailorName,
      tailorShopName: nonEmpty(existing.tailorShopName) ? existing.tailorShopName : injectedRow.tailorShopName,
      garmentType: nonEmpty(existing.garmentType) ? existing.garmentType : injectedRow.garmentType,
      lastMessage: nonEmpty(existing.lastMessage) ? existing.lastMessage : injectedRow.lastMessage,
      lastMessageAt: nonEmpty(existing.lastMessageAt)
        ? existing.lastMessageAt
        : injectedRow.lastMessageAt || existing.updatedAt,
    };
    const next = [...base];
    next[idx] = merged;
    return sortWorkspaceConversationsDesc(dedupeConversationsByOrderId(next));
  }
  return sortWorkspaceConversationsDesc(dedupeConversationsByOrderId([injectedRow, ...base]));
}
