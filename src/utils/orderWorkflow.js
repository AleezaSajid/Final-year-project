import {
  getTrackingStatus,
  getWorkflowIndex,
  normalizeWorkflowStatus,
  resolveWorkflowState,
  workflowStages,
} from "./workflowEngine.js";

/** Canonical workflow from shared workflow engine. */
export const ORDER_WORKFLOW_STEPS = workflowStages;

export const ORDER_WORKFLOW_STATUSES = ORDER_WORKFLOW_STEPS.map((s) => s.status);

/**
 * @param {Record<string, unknown> | null | undefined} order
 */
export function getWorkflowIndexFromOrder(order) {
  if (!order || typeof order !== "object") return 0;
  if (order.currentStepIndex != null && Number.isFinite(Number(order.currentStepIndex))) {
    return Math.max(0, Math.min(ORDER_WORKFLOW_STEPS.length - 1, Number(order.currentStepIndex)));
  }
  return getWorkflowIndex(order.status);
}

/**
 * @param {Record<string, unknown> | null | undefined} order
 */
export function isOrderWorkflowCompleted(order) {
  return resolveWorkflowState(order).internalStatus === "completed";
}

/**
 * @param {number} activeIndex 0..6
 */
export function getNextWorkflowLabel(activeIndex) {
  if (activeIndex >= ORDER_WORKFLOW_STEPS.length - 1) return "—";
  const next = ORDER_WORKFLOW_STEPS[activeIndex + 1];
  return next ? next.label : "—";
}

export {
  isCustomerTrackableActiveOrder,
  pickLatestTrackableCustomerOrder,
} from "./workflowEngine.js";
export { normalizeWorkflowStatus };
export { getTrackingStatus };
