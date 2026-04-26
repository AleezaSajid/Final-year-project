import { getTrackingStatus, normalizeWorkflowStatus, ORDER_WORKFLOW_STEPS } from "./orderWorkflow.js";

/** Shared live-tracking enums (uppercase) — same on tailor emit and customer receive. */
export const TRACKING_STATUS = {
  ORDER_PLACED: "ORDER_PLACED",
  MEASUREMENTS_VERIFIED: "MEASUREMENTS_VERIFIED",
  STITCHING: "STITCHING",
  QUALITY_CHECK: "QUALITY_CHECK",
  READY: "READY",
  COMPLETED: "COMPLETED",
};

/** Progress weights for live updates (customer + tailor logic). */
export const TRACKING_STATUS_PROGRESS = {
  [TRACKING_STATUS.ORDER_PLACED]: 0,
  [TRACKING_STATUS.MEASUREMENTS_VERIFIED]: 20,
  [TRACKING_STATUS.STITCHING]: 40,
  [TRACKING_STATUS.QUALITY_CHECK]: 70,
  [TRACKING_STATUS.READY]: 90,
  [TRACKING_STATUS.COMPLETED]: 100,
};

/**
 * @param {string} internalNormalized  Tailor/dashboard normalized status (lowercase snake).
 * @returns {keyof typeof TRACKING_STATUS | null}
 */
export function internalStatusToTrackingEnum(internalNormalized) {
  return getTrackingStatus(internalNormalized);
}

/**
 * @param {string} orderId
 * @param {string} internalNormalized
 */
export function buildOrderStatusSocketPayload(orderId, internalNormalized) {
  const tracking = internalStatusToTrackingEnum(internalNormalized);
  const status = tracking || TRACKING_STATUS.ORDER_PLACED;
  return {
    orderId: String(orderId),
    status,
    updatedAt: Date.now(),
  };
}

/**
 * @param {string} trackingUpper  e.g. "QUALITY_CHECK"
 * @returns {string} internal workflow status for ORDER_WORKFLOW_STEPS
 */
export function trackingEnumToInternalStatus(trackingUpper) {
  const u = String(trackingUpper || "")
    .trim()
    .toUpperCase();
  switch (u) {
    case TRACKING_STATUS.ORDER_PLACED:
      return "order_placed";
    case TRACKING_STATUS.MEASUREMENTS_VERIFIED:
      return "measurements_verified";
    case TRACKING_STATUS.STITCHING:
      return "stitching";
    case TRACKING_STATUS.QUALITY_CHECK:
      return "quality_check";
    case TRACKING_STATUS.READY:
      return "ready_for_delivery";
    case TRACKING_STATUS.COMPLETED:
      return "completed";
    default:
      return "order_placed";
  }
}

/**
 * READY is shared for ready_for_delivery and last_review; disambiguate from current step.
 * @param {string} trackingUpper
 * @param {number} currentStepIndex  index in ORDER_WORKFLOW_STEPS
 */
export function resolveInternalStatusFromTracking(trackingUpper, currentStepIndex) {
  const u = String(trackingUpper || "")
    .trim()
    .toUpperCase();
  if (u !== TRACKING_STATUS.READY) {
    return trackingEnumToInternalStatus(trackingUpper);
  }
  const idx = Math.max(0, Math.min(ORDER_WORKFLOW_STEPS.length - 1, Number(currentStepIndex) || 0));
  if (idx < 4) return "ready_for_delivery";
  return "last_review";
}

/**
 * @param {string} trackingUpper
 * @returns {number} 0..100
 */
export function trackingEnumToProgress(trackingUpper) {
  const u = String(trackingUpper || "")
    .trim()
    .toUpperCase();
  return TRACKING_STATUS_PROGRESS[u] ?? 0;
}

/**
 * Workflow step index aligned with ORDER_WORKFLOW_STEPS (for customer timeline).
 * @param {string} trackingUpper
 * @param {number} [currentStepIndex]
 */
export function trackingEnumToWorkflowStepIndex(trackingUpper, currentStepIndex = 0) {
  const internal = resolveInternalStatusFromTracking(trackingUpper, currentStepIndex);
  const normalized = normalizeWorkflowStatus(internal);
  const i = ORDER_WORKFLOW_STEPS.findIndex((step) => step.status === normalized);
  return i >= 0 ? i : 0;
}
