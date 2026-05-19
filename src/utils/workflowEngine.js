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
  "accepted",
  "pending",
  "measurements_verified",
  "stitching",
  "quality_check",
  "ready_for_delivery",
  "last_review",
  "processing",
  "in_progress",
]);

const TAILOR_TASK_TERMINAL = new Set([
  "completed",
  "cancelled",
  "canceled",
  "rejected",
  "declined",
  "delivered",
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
    ACCEPTED: "accepted",
    ACTIVE: "accepted",
    NEEDS_ALTERATION: "needs_alteration",
  };
  return map[u] || "";
}

export function normalizeWorkflowStatus(value) {
  let s = toSnake(value || "pending");
  if (s === "rejected" || s === "declined" || s === "cancelled" || s === "canceled") return s;
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
  if (normalized === "accepted") return "ORDER_PLACED";
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

  if (internalStatus === "accepted") {
    const claimed =
      input.isActive === true ||
      (input.acceptedAt != null && String(input.acceptedAt).trim() !== "");
    if (claimed) {
      internalStatus = "accepted";
    } else if (idx != null) {
      internalStatus = workflowStages[idx]?.status || "pending";
    } else {
      internalStatus = "pending";
    }
  }

  const workflowIndex =
    idx != null && internalStatus !== "completed"
      ? Math.max(0, Math.min(workflowStages.length - 1, idx))
      : getWorkflowIndex(internalStatus);
  const trackingStatus = getTrackingStatus(internalStatus);
  const workflowStatus = internalStatus;
  const isTailorActive = TAILOR_ACTIVE_SET.has(internalStatus);
  const isCustomerVisible = CUSTOMER_VISIBLE_SET.has(internalStatus);
  return { internalStatus, workflowIndex, workflowStatus, trackingStatus, isTailorActive, isCustomerVisible };
}

function isTailorTaskTerminal(order) {
  const input = order && typeof order === "object" ? order : {};
  const state = resolveWorkflowState(input);
  const raw = toSnake(input.status ?? input.workflowStatus ?? "");
  return TAILOR_TASK_TERMINAL.has(state.internalStatus) || TAILOR_TASK_TERMINAL.has(raw);
}

export function normalizeOrderStatusToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

const TAILOR_EXCLUDED_TASK_STATUSES = new Set([
  "rejected",
  "declined",
  "cancelled",
  "canceled",
  "delivered",
  "completed",
]);

const TAILOR_CURRENT_TASK_STATUSES = new Set([
  "accepted",
  "active",
  "in_progress",
  "processing",
  "measurements_verified",
  "stitching",
  "quality_check",
  "ready_for_delivery",
  "last_review",
  "needs_alteration",
]);

/** Terminal / declined — excluded from Current Tasks, Measurements, and in-progress counts. */
export function isTailorOrderExcludedFromTasks(order) {
  if (!order || typeof order !== "object") return true;
  if (order.rejectedAt != null && String(order.rejectedAt).trim() !== "") return true;

  const status = normalizeOrderStatusToken(order.status);
  const wf = normalizeOrderStatusToken(order.workflowStatus);
  const convSt = normalizeOrderStatusToken(
    order.conversation?.status ?? order.conversationStatus
  );

  if (TAILOR_EXCLUDED_TASK_STATUSES.has(status)) return true;
  if (TAILOR_EXCLUDED_TASK_STATUSES.has(wf)) return true;
  if (convSt === "rejected" || convSt === "declined") return true;

  return false;
}

export function isTailorActiveTask(order) {
  const input = order && typeof order === "object" ? order : {};
  const state = resolveWorkflowState(input);
  if (state.isTailorActive) return true;
  if (input.isActive === true || input.acceptedAt) return true;
  const raw = toSnake(input.status ?? input.workflowStatus ?? "");
  return raw === "accepted" || raw === "active" || raw === "in_progress" || raw === "processing";
}

/**
 * Current Tasks: accepted in-progress work only.
 * Requires isActive === true; excludes rejected/locked/pending/completed rows.
 */
export function isTailorCurrentTaskOrder(order) {
  if (!order || typeof order !== "object") return false;
  if (isTailorOrderExcludedFromTasks(order)) return false;
  if (order.isActive !== true) return false;

  const hasAcceptedAt = order.acceptedAt != null && String(order.acceptedAt).trim() !== "";
  if (hasAcceptedAt) return true;

  const status = normalizeOrderStatusToken(order.status);
  const wf = normalizeOrderStatusToken(order.workflowStatus);

  if (
    status === "accepted" ||
    status === "in_progress" ||
    status === "processing" ||
    wf === "accepted" ||
    wf === "order_placed" ||
    wf === "in_progress" ||
    wf === "processing"
  ) {
    return true;
  }

  if (
    status === "pending" ||
    status === "order_placed" ||
    status === "awaiting_acceptance" ||
    status === "awaiting_tailor_selection" ||
    status === "draft"
  ) {
    return false;
  }

  if (TAILOR_CURRENT_TASK_STATUSES.has(status) || TAILOR_CURRENT_TASK_STATUSES.has(wf)) {
    return true;
  }

  const internal = resolveWorkflowState(order).internalStatus;
  if (TAILOR_EXCLUDED_TASK_STATUSES.has(internal)) return false;
  if (internal === "pending" || internal === "order_placed") return false;
  return TAILOR_CURRENT_TASK_STATUSES.has(internal);
}

/** Schedule date for tailor calendar (due / delivery fields, then createdAt). */
export function getTailorOrderScheduleDate(order) {
  if (!order || typeof order !== "object") return "";
  const candidates = [
    order.dueDate,
    order.preferredDueDate,
    order.deliveryDate,
    order.deadline,
    order.notes?.deliveryDate,
    order.orderPayload?.notes?.deliveryDate,
    order.wizardData?.designBrief?.deliveryDate,
    order.date,
    order.createdAt,
  ];
  for (const value of candidates) {
    const s = value != null ? String(value).trim() : "";
    if (s) return s;
  }
  return "";
}

const TAILOR_MEASUREMENT_REVIEW_STATUSES = new Set([
  "pending",
  "order_placed",
  "awaiting_acceptance",
  "awaiting_tailor_selection",
  "awaiting_measurements",
  "measurement_submitted",
  "measurements_submitted",
  "awaiting_review",
]);

/** Measurements to Review: pending / awaiting measurement review only (strict allowlist). */
export function isTailorMeasurementReviewOrder(order) {
  if (!order || typeof order !== "object") return false;
  if (isTailorOrderExcludedFromTasks(order)) return false;
  if (order.isActive === true) return false;
  if (order.acceptedAt) return false;

  const status = normalizeOrderStatusToken(order.status);
  const wf = normalizeOrderStatusToken(order.workflowStatus);

  return (
    TAILOR_MEASUREMENT_REVIEW_STATUSES.has(status) ||
    TAILOR_MEASUREMENT_REVIEW_STATUSES.has(wf)
  );
}

const CUSTOMER_TRACK_SKIP = new Set(["draft", "awaiting_tailor_selection"]);

/** Customer Track Order: accepted/in-progress orders (not completed/cancelled). */
export function isCustomerTrackableActiveOrder(order) {
  if (!order || typeof order !== "object") return false;
  if (isTailorTaskTerminal(order)) return false;
  const raw = toSnake(order.status ?? order.workflowStatus ?? "");
  if (CUSTOMER_TRACK_SKIP.has(raw)) return false;
  if (order.isActive === true) return true;
  if (order.acceptedAt) return true;
  if (raw === "accepted" || raw === "active" || raw === "in_progress" || raw === "processing") {
    return true;
  }
  const wf = order.workflowStatus != null ? String(order.workflowStatus).trim() : "";
  if (wf) {
    const w = toSnake(wf);
    if (!CUSTOMER_TRACK_SKIP.has(w) && !TAILOR_TASK_TERMINAL.has(w)) return true;
  }
  const tailorId = String(order.tailorId ?? "").trim();
  if (tailorId && (raw === "pending" || isTailorActiveTask(order))) return true;
  return false;
}

export function pickLatestTrackableCustomerOrder(orders) {
  const rows = (Array.isArray(orders) ? orders : []).filter(isCustomerTrackableActiveOrder);
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const score = (o) =>
      (o.isActive === true ? 4 : 0) +
      (o.acceptedAt ? 2 : 0) +
      new Date(o.updatedAt || o.acceptedAt || o.createdAt || 0).getTime() / 1e12;
    return score(b) - score(a);
  })[0];
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
