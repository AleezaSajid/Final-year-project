const WORKFLOW_DEBUG = true;

export const workflowStages = [
  { status: "pending", label: "Order Placed" },
  { status: "measurements_verified", label: "Measurements Verified" },
  { status: "stitching", label: "Stitching" },
  { status: "quality_check", label: "Quality Check" },
  { status: "ready_for_delivery", label: "Ready for Delivery" },
  { status: "last_review", label: "Last Review" },
  { status: "completed", label: "Completed" },
];

const STAGE_BY_STATUS = new Map(workflowStages.map((s, i) => [s.status, i]));
const CANONICAL = new Set([
  ...workflowStages.map((s) => s.status),
  "order_placed",
  "processing",
  "in_progress",
  "needs_alteration",
]);

const TAILOR_ACTIVE_SET = new Set([
  "pending",
  "measurements_verified",
  "stitching",
  "quality_check",
  "ready_for_delivery",
  "last_review",
]);

const CUSTOMER_VISIBLE_SET = new Set(workflowStages.map((s) => s.status));

function log(scope, message, payload) {
  if (!WORKFLOW_DEBUG) return;
  if (payload === undefined) {
    // eslint-disable-next-line no-console
    console.log(`[${scope}] ${message}`);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[${scope}] ${message}`, payload);
}

function toSnake(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function socketEnumToInternal(raw, currentStepIndex) {
  const u = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!u) return "";
  if (u === "READY") {
    const idx = Number(currentStepIndex);
    return Number.isFinite(idx) && idx >= 5 ? "last_review" : "ready_for_delivery";
  }
  const map = {
    ORDER_PLACED: "pending",
    PENDING: "pending",
    MEASUREMENTS_VERIFIED: "measurements_verified",
    STITCHING: "stitching",
    QUALITY_CHECK: "quality_check",
    READY_FOR_DELIVERY: "ready_for_delivery",
    LAST_REVIEW: "last_review",
    COMPLETED: "completed",
    PROCESSING: "processing",
    IN_PROGRESS: "in_progress",
    NEEDS_ALTERATION: "needs_alteration",
  };
  return map[u] || "";
}

export function normalizeWorkflowStatus(value) {
  let s = toSnake(value || "pending");
  if (s === "accepted" || s === "active") return "accepted";
  if (s === "inprogress") s = "in_progress";
  if (s === "orderplaced" || s === "order_placed") s = "pending";
  if (s === "new") s = "pending";
  if (s === "measurement_done" || s === "measurements_done") s = "measurements_verified";
  if (s === "delivered") s = "completed";
  if (s === "processing" || s === "in_progress" || s === "needs_alteration") s = "stitching";
  return CANONICAL.has(s) ? (s === "order_placed" ? "pending" : s) : "pending";
}

export function getWorkflowIndex(status) {
  const normalized = normalizeWorkflowStatus(status);
  return STAGE_BY_STATUS.get(normalized) ?? 0;
}

export function getTrackingStatus(status) {
  const normalized = normalizeWorkflowStatus(status);
  if (normalized === "pending") return "ORDER_PLACED";
  if (normalized === "measurements_verified") return "MEASUREMENTS_VERIFIED";
  if (normalized === "stitching") return "STITCHING";
  if (normalized === "quality_check") return "QUALITY_CHECK";
  if (normalized === "ready_for_delivery" || normalized === "last_review") return "READY";
  return "COMPLETED";
}

export function resolveWorkflowState(order) {
  const input = order && typeof order === "object" ? order : {};
  const statusRaw = input.status;
  const hasStatus = statusRaw != null && String(statusRaw).trim() !== "";
  const idxRaw = input.currentStepIndex ?? input.currentStep;
  const idx =
    idxRaw != null && Number.isFinite(Number(idxRaw))
      ? Math.max(0, Math.min(workflowStages.length - 1, Number(idxRaw)))
      : null;

  let internalStatus = "pending";
  if (hasStatus) {
    internalStatus = normalizeWorkflowStatus(statusRaw);
  } else {
    const fromWorkflowStatus = socketEnumToInternal(input.workflowStatus, idx);
    if (fromWorkflowStatus) {
      internalStatus = normalizeWorkflowStatus(fromWorkflowStatus);
    } else if (idx != null) {
      internalStatus = workflowStages[idx]?.status || "pending";
    }
  }

  const mappedWorkflow = socketEnumToInternal(input.workflowStatus, idx);
  if (hasStatus && mappedWorkflow) {
    const fromStatus = normalizeWorkflowStatus(statusRaw);
    const fromWorkflow = normalizeWorkflowStatus(mappedWorkflow);
    if (fromStatus !== fromWorkflow) {
      log("Workflow Engine", "WORKFLOW MISMATCH DETECTED", {
        orderId: input.id ?? input._id ?? "",
        fromStatus,
        fromWorkflow,
      });
    }
  }

  const workflowIndex = getWorkflowIndex(internalStatus);
  const trackingStatus = getTrackingStatus(internalStatus);
  const workflowStatus = internalStatus;
  const isTailorActive = TAILOR_ACTIVE_SET.has(internalStatus);
  const isCustomerVisible = CUSTOMER_VISIBLE_SET.has(internalStatus);
  return { internalStatus, workflowIndex, workflowStatus, trackingStatus, isTailorActive, isCustomerVisible };
}

export function isTailorActiveTask(order) {
  return resolveWorkflowState(order).isTailorActive;
}

export function isCustomerVisibleTask(order) {
  return resolveWorkflowState(order).isCustomerVisible;
}

export function getPriorityScore(order) {
  const state = resolveWorkflowState(order);
  const urgencyRaw =
    order?.notes?.urgency || order?.orderPayload?.notes?.urgency || order?.wizardData?.designBrief?.urgency || "";
  const urgency = String(urgencyRaw).toLowerCase();
  const urgencyWeight = urgency === "express" ? 0 : urgency === "urgent" ? 1 : 2;
  const due = new Date(order?.dueDate || order?.date || 0).getTime();
  const dueWeight = Number.isFinite(due) ? due : Number.MAX_SAFE_INTEGER;
  return urgencyWeight * 1_000_000_000_000 + dueWeight * 10 + state.workflowIndex;
}
