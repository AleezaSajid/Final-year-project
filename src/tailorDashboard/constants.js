import {
  getTrackingStatus,
  getWorkflowIndex,
  normalizeWorkflowStatus,
  resolveWorkflowState,
  workflowStages as ENGINE_WORKFLOW_STAGES,
} from "../utils/workflowEngine.js";

export const SHARED_ORDER_STORAGE_KEY = "sewserve_orders";
export const TAILOR_PROFILE_STORAGE_KEY = "sewserve_tailor_profiles";
export const GARMENT_REGEX = /^[A-Za-z ]+$/;
/** Demo / legacy fallback when an order document has no `tailorId`. Real dashboards use `resolveTailorIdWhenViewingAsTailor`. */
export const DEFAULT_TAILOR_SHOP_ID = "T-A1";
/** Same cap for “Current Tasks” and “Measurements to Review” (priority-sorted). */
export const TAILOR_CURRENT_TASKS_VISIBLE_MAX = 2;
export const DEFAULT_CUSTOMER_ID = "CU-001";
export const API_BASE_URL = "http://localhost:5000";
export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#FFF7ED"/>
    <circle cx="60" cy="44" r="22" fill="#FDBA74"/>
    <path d="M22 108c4-20 18-32 38-32s34 12 38 32" fill="#FDBA74"/>
  </svg>`
)}`;

/** Shared workflow source of truth (from workflowEngine). */
export const workflowStages = ENGINE_WORKFLOW_STAGES;

/** All non-terminal statuses (stats / “active” work). */
export const WORKFLOW_NON_COMPLETED_STATUSES = new Set([
  "accepted",
  "pending",
  "order_placed",
  "measurements_verified",
  "processing",
  "in_progress",
  "stitching",
  "quality_check",
  "ready_for_delivery",
  "last_review",
  "needs_alteration",
]);

/**
 * Formatting-only normalization: lowercase, spaces → underscores. Preserves semantic distinctions
 * (processing vs in_progress vs stitching).
 */
export const normalizeStatus = (value) => normalizeWorkflowStatus(value);

export function isPendingWorkflowStatus(status) {
  const s = normalizeStatus(status);
  return s === "pending";
}

function mongoIdToString(maybe) {
  if (maybe == null) return null;
  if (typeof maybe === "object" && maybe !== null && "$oid" in maybe && maybe.$oid != null) {
    return String(maybe.$oid);
  }
  const str = String(maybe);
  if (str === "[object Object]") return null;
  return str;
}

/** Socket / API uppercase enums → snake_case consumed by `normalizeStatus`. */
export function socketEnumToSnake(raw, currentStepIndex) {
  const u = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!u) return "";
  const map = {
    ORDER_PLACED: "order_placed",
    PENDING: "pending",
    MEASUREMENTS_VERIFIED: "measurements_verified",
    STITCHING: "stitching",
    QUALITY_CHECK: "quality_check",
    COMPLETED: "completed",
    PROCESSING: "processing",
    IN_PROGRESS: "in_progress",
    NEEDS_ALTERATION: "needs_alteration",
    READY_FOR_DELIVERY: "ready_for_delivery",
    LAST_REVIEW: "last_review",
  };
  if (u === "READY") {
    const idx = Number(currentStepIndex);
    return Number.isFinite(idx) && idx >= 7 ? "last_review" : "ready_for_delivery";
  }
  return map[u] || "";
}

/** Aligns with backend / customer `order:live` tracking enums. */
export function internalStatusToTrackingEnum(internal) {
  return getTrackingStatus(internal);
}

export const getStatusIndex = (status) => {
  return getWorkflowIndex(status);
};

export const formatStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "needs_alteration") return "Needs Alteration";
  if (normalized === "accepted") return "Order Placed";
  const label = workflowStages.find((stage) => stage.status === normalized)?.label;
  if (label) return label;
  if (normalized === "order_placed") return "Order Placed";
  return "Pending";
};

/**
 * Single workflow resolver: backend `status` → `workflowStatus` → `currentStepIndex` → socket enums.
 * `workflowStages` defines step order; index always derived from resolved internal status.
 */
export function resolveOrderWorkflowState(order) {
  const r = resolveWorkflowState(order);
  return {
    internalStatus: r.internalStatus,
    workflowIndex: r.workflowIndex,
    trackingEnum: r.trackingStatus,
    isActiveTask: r.isTailorActive,
  };
}

export const defaultProfiles = {
  "T-A1": {
    name: "Ayesha Tailors",
    contact: "+92-300-1111111",
    email: "ayesha@sewserve.com",
    skills: "Bridal, Formal, Casual",
  },
  "T-B2": {
    name: "Noor Stitch House",
    contact: "+92-300-2222222",
    email: "noor@sewserve.com",
    skills: "Abaya, Eastern Wear",
  },
};

export const seedOrders = [
  {
    id: "ORD-901",
    customerName: "Mariam Ali",
    garmentType: "Bridal Gown",
    status: "Pending",
    date: "2026-04-10",
    dueDate: "2026-04-16",
    workflowStep: 0,
    tailorId: "T-A1",
    price: 22000,
    orderImages: [],
  },
  {
    id: "ORD-902",
    customerName: "Hina Malik",
    garmentType: "Formal Suit",
    status: "In Progress",
    date: "2026-04-08",
    dueDate: "2026-04-13",
    workflowStep: 2,
    tailorId: "T-A1",
    price: 8500,
    orderImages: [],
  },
  {
    id: "ORD-903",
    customerName: "Sara Khan",
    garmentType: "Abaya",
    status: "Completed",
    date: "2026-04-02",
    dueDate: "2026-04-07",
    workflowStep: 4,
    tailorId: "T-B2",
    price: 6000,
    orderImages: [],
  },
];

export const normalizeOrder = (order) => {
  const { internalStatus: normalizedStatus, workflowIndex } = resolveOrderWorkflowState(order);
  const idFromDoc =
    order.id != null && String(order.id).trim() !== ""
      ? String(order.id).trim()
      : mongoIdToString(order._id);
  return {
    id: idFromDoc || `ORD-${Date.now()}`,
    _id: mongoIdToString(order._id) || idFromDoc,
    customerName: order.customerName || "Customer",
    customerId:
      order.customerId ||
      `C-${String(order.customerName || order.id || "CUSTOMER")
        .trim()
        .replace(/\s+/g, "-")
        .toUpperCase()}`,
    garmentType: order.garmentType || "Garment",
    status: normalizedStatus,
    date: order.date || new Date().toISOString().slice(0, 10),
    createdAt: order.createdAt || order.date || new Date().toISOString(),
    dueDate: order.dueDate || order.date || new Date().toISOString().slice(0, 10),
    workflowStep: workflowIndex,
    tailorId: order.tailorId || DEFAULT_TAILOR_SHOP_ID,
    price: Number(order.price || 0),
    orderImages: Array.isArray(order.orderImages) ? order.orderImages : [],
    measurements:
      order.measurements && typeof order.measurements === "object" && !Array.isArray(order.measurements)
        ? order.measurements
        : {},
    orderPayload: order.orderPayload != null ? order.orderPayload : undefined,
    wizardData:
      order.wizardData && typeof order.wizardData === "object" && !Array.isArray(order.wizardData)
        ? order.wizardData
        : undefined,
    customerPhone:
      order.customerPhone != null && String(order.customerPhone).trim() !== "" ? String(order.customerPhone) : "",
    style: order.style && typeof order.style === "object" && !Array.isArray(order.style) ? order.style : null,
    notes: order.notes && typeof order.notes === "object" && !Array.isArray(order.notes) ? order.notes : null,
    workflowStatus: normalizedStatus,
    currentStepIndex: workflowIndex,
    isActive: order.isActive === true,
    chatEnabled: order.chatEnabled !== false,
    acceptedAt: order.acceptedAt || null,
  };
};

export const getProfileImageSrc = (picture) => (picture ? picture : DEFAULT_AVATAR);

export const readProfilesFromStorage = () => {
  try {
    const saved = localStorage.getItem(TAILOR_PROFILE_STORAGE_KEY);
    return saved ? { ...defaultProfiles, ...JSON.parse(saved) } : defaultProfiles;
  } catch {
    return defaultProfiles;
  }
};
