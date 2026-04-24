export const SHARED_ORDER_STORAGE_KEY = "sewserve_orders";
export const TAILOR_PROFILE_STORAGE_KEY = "sewserve_tailor_profiles";
export const GARMENT_REGEX = /^[A-Za-z ]+$/;
export const tailorId = "T-A1";
export const DEFAULT_CUSTOMER_ID = "CU-001";
export const API_BASE_URL = "http://localhost:5000";
export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#FFF7ED"/>
    <circle cx="60" cy="44" r="22" fill="#FDBA74"/>
    <path d="M22 108c4-20 18-32 38-32s34 12 38 32" fill="#FDBA74"/>
  </svg>`
)}`;

export const workflowStages = [
  { status: "pending", label: "Order Placed" },
  { status: "measurements_verified", label: "Measurements Verified" },
  { status: "stitching", label: "Stitching" },
  { status: "quality_check", label: "Quality Check" },
  { status: "ready_for_delivery", label: "Ready for Delivery" },
  { status: "last_review", label: "Last Review" },
  { status: "completed", label: "Completed" },
];

export const normalizeStatus = (value) => {
  const status = String(value || "pending").trim().toLowerCase();
  if (status === "in_progress" || status === "in progress") return "stitching";
  if (status === "needs_alteration") return "needs_alteration";
  if (workflowStages.some((stage) => stage.status === status)) return status;
  return "pending";
};

export const getStatusIndex = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "needs_alteration") return workflowStages.findIndex((stage) => stage.status === "last_review");
  const index = workflowStages.findIndex((stage) => stage.status === normalized);
  return index >= 0 ? index : 0;
};

export const formatStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "needs_alteration") return "Needs Alteration";
  return workflowStages.find((stage) => stage.status === normalized)?.label || "Pending";
};

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

export const normalizeOrder = (order) => ({
  id:
    order.id != null
      ? String(order.id)
      : order._id != null
        ? String(order._id)
        : `ORD-${Date.now()}`,
  customerName: order.customerName || "Customer",
  customerId:
    order.customerId ||
    `C-${String(order.customerName || order.id || "CUSTOMER")
      .trim()
      .replace(/\s+/g, "-")
      .toUpperCase()}`,
  garmentType: order.garmentType || "Garment",
  status: normalizeStatus(order.status),
  date: order.date || new Date().toISOString().slice(0, 10),
  createdAt: order.createdAt || order.date || new Date().toISOString(),
  dueDate: order.dueDate || order.date || new Date().toISOString().slice(0, 10),
  workflowStep: getStatusIndex(order.status),
  tailorId: order.tailorId || tailorId,
  price: Number(order.price || 0),
  orderImages: Array.isArray(order.orderImages) ? order.orderImages : [],
  measurements:
    order.measurements && typeof order.measurements === "object" && !Array.isArray(order.measurements)
      ? order.measurements
      : {},
  orderPayload: order.orderPayload != null ? order.orderPayload : undefined,
  /** Full unfiltered measurement wizard state when synced via measurement:review */
  wizardData:
    order.wizardData && typeof order.wizardData === "object" && !Array.isArray(order.wizardData)
      ? order.wizardData
      : undefined,
  customerPhone: order.customerPhone != null && String(order.customerPhone).trim() !== "" ? String(order.customerPhone) : "",
  style:
    order.style && typeof order.style === "object" && !Array.isArray(order.style) ? order.style : null,
  notes: order.notes && typeof order.notes === "object" && !Array.isArray(order.notes) ? order.notes : null,
});

export const getProfileImageSrc = (picture) => (picture ? picture : DEFAULT_AVATAR);

export const readProfilesFromStorage = () => {
  try {
    const saved = localStorage.getItem(TAILOR_PROFILE_STORAGE_KEY);
    return saved ? { ...defaultProfiles, ...JSON.parse(saved) } : defaultProfiles;
  } catch {
    return defaultProfiles;
  }
};
