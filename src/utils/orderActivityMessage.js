import { internalStatusToTrackingEnum } from "./orderLiveStatus.js";
import { normalizeWorkflowStatus } from "./orderWorkflow.js";

const ACTIVITY_BY_TRACKING = {
  ORDER_PLACED: "Order has been placed",
  MEASUREMENTS_VERIFIED: "Tailor is verifying measurements",
  STITCHING: "Tailor is stitching your order",
  QUALITY_CHECK: "Quality check in progress",
  READY: "Order is ready for delivery",
  COMPLETED: "Order delivered successfully",
};

/**
 * @param {string | undefined | null} status — tracking enum (e.g. STITCHING) or internal workflow status from API
 */
export function getOrderActivityMessage(status) {
  if (status == null || String(status).trim() === "") {
    return "Processing your order...";
  }
  const raw = String(status).trim();
  if (ACTIVITY_BY_TRACKING[raw]) return ACTIVITY_BY_TRACKING[raw];
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (ACTIVITY_BY_TRACKING[upper]) return ACTIVITY_BY_TRACKING[upper];
  const internal = normalizeWorkflowStatus(raw);
  const tracking = internalStatusToTrackingEnum(internal);
  if (tracking && ACTIVITY_BY_TRACKING[tracking]) return ACTIVITY_BY_TRACKING[tracking];
  return "Processing your order...";
}
