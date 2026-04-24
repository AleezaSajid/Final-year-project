/**
 * Canonical order workflow (matches backend / tailor dashboard).
 * @type {{ status: string, label: string }[]}
 */
export const ORDER_WORKFLOW_STEPS = [
  { status: "order_placed", label: "Order Placed" },
  { status: "measurements_verified", label: "Measurements Verified" },
  { status: "stitching", label: "Stitching" },
  { status: "quality_check", label: "Quality Check" },
  { status: "ready_for_delivery", label: "Ready for Delivery" },
  { status: "last_review", label: "Last Review" },
  { status: "completed", label: "Completed" },
];

export const ORDER_WORKFLOW_STATUSES = ORDER_WORKFLOW_STEPS.map((s) => s.status);

/**
 * @param {string | undefined} raw
 */
export function normalizeWorkflowStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "pending" || s === "new" || s === "processing" || s === "order_placed") return "order_placed";
  if (s === "measurement_done" || s === "measurements_done" || s === "measurements_verified") {
    return "measurements_verified";
  }
  if (s === "in_progress" || s === "inprogress") return "stitching";
  if (s === "delivered") return "completed";
  if (ORDER_WORKFLOW_STATUSES.includes(s)) return s;
  return "order_placed";
}

/**
 * @param {Record<string, unknown> | null | undefined} order
 */
export function getWorkflowIndexFromOrder(order) {
  if (!order || typeof order !== "object") return 0;
  const status = normalizeWorkflowStatus(order.status);
  const fromStatus = ORDER_WORKFLOW_STATUSES.indexOf(status);
  if (fromStatus >= 0) return fromStatus;
  const raw = order.currentStepIndex;
  if (raw != null && Number.isFinite(Number(raw))) {
    const n = Math.max(0, Math.min(ORDER_WORKFLOW_STEPS.length - 1, Number(raw)));
    return n;
  }
  return 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} order
 */
export function isOrderWorkflowCompleted(order) {
  return normalizeWorkflowStatus(order?.status) === "completed";
}

/**
 * @param {number} activeIndex 0..6
 */
export function getNextWorkflowLabel(activeIndex) {
  if (activeIndex >= ORDER_WORKFLOW_STEPS.length - 1) return "—";
  const next = ORDER_WORKFLOW_STEPS[activeIndex + 1];
  return next ? next.label : "—";
}
