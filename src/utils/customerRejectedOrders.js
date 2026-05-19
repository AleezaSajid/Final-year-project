import { isOrderRejected } from "../chatUtils.js";

export { isOrderRejected as isCustomerOrderRejected };

export function orderIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a).trim() === String(b).trim();
}

export function resolveTailorNameForDeclinedNotice(tailorId, tailorCatalog, lastRequest) {
  const fromRef = lastRequest?.tailorName;
  if (fromRef && String(fromRef).trim()) return String(fromRef).trim();
  const tid = String(tailorId || "").trim();
  if (!tid) return "This tailor";
  const hit = (Array.isArray(tailorCatalog) ? tailorCatalog : []).find(
    (t) => String(t.tailorShopId || "") === tid || String(t.id || "") === tid
  );
  return hit?.name || hit?.shopName || "This tailor";
}

export function buildDeclinedNoticeFromOrder(order, tailorCatalog = [], lastRequest = null) {
  if (!order || typeof order !== "object" || !isOrderRejected(order)) return null;
  const orderId = String(order.id ?? order._id ?? "").trim();
  const tailorId = String(order.tailorId ?? order.rejectedBy ?? lastRequest?.tailorId ?? "").trim();
  const reason = String(order.rejectionReason ?? "").trim();
  return {
    orderId,
    tailorId,
    tailorName: resolveTailorNameForDeclinedNotice(tailorId, tailorCatalog, lastRequest),
    reason,
  };
}

export function declinedNoticeFromSocketPayload(payload, tailorCatalog = [], lastRequest = null) {
  if (!payload || typeof payload !== "object") return null;
  return buildDeclinedNoticeFromOrder(
    {
      id: payload.orderId,
      _id: payload.orderId,
      tailorId: payload.tailorId,
      rejectionReason: payload.rejectionReason,
      rejectedAt: payload.rejectedAt,
      rejectedBy: payload.rejectedBy,
      status: payload.status || "rejected",
      workflowStatus: payload.workflowStatus || "rejected",
    },
    tailorCatalog,
    lastRequest
  );
}
