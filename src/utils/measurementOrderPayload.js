/**
 * Structured order payload for Measurement Wizard → POST /api/orders (or legacy /orders).
 * Garment labels stay in sync with wizard + customerRecentOrdersStorage.
 */

import { garmentDisplayFromWizardPayload } from "./customerRecentOrdersStorage.js";
import { resolveCustomerIdForChat, resolveTailorIdForCustomerChat } from "./chatIdentity.js";
import { tailorId as dashboardDefaultTailorId, workflowStages } from "../tailorDashboard/constants.js";

const FIT_TYPE_OPTIONS = [
  { id: "slim", label: "Slim Fit" },
  { id: "regular", label: "Regular Fit" },
  { id: "loose", label: "Loose Fit" },
];

const FABRIC_TYPE_OPTIONS = [
  { id: "cotton", label: "Cotton" },
  { id: "linen", label: "Linen" },
  { id: "wool", label: "Wool" },
  { id: "silk", label: "Silk" },
];

const STYLE_PREFERENCE_OPTIONS = [
  { id: "formal", label: "Formal" },
  { id: "casual", label: "Casual" },
  { id: "traditional", label: "Traditional" },
  { id: "modern", label: "Modern" },
];

const NECK_OPTIONS = [
  { id: "round", label: "Round" },
  { id: "v-neck", label: "V-Neck" },
  { id: "collar", label: "Collar" },
  { id: "boat", label: "Boat" },
];

const OCCASION_OPTIONS = [
  { id: "wedding", label: "Wedding" },
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "party", label: "Party" },
];

const URGENCY_OPTIONS = [
  { id: "normal", label: "Normal" },
  { id: "urgent", label: "Urgent" },
  { id: "express", label: "Express" },
];

const SPECIAL_INSTRUCTION_OPTIONS = [
  { id: "extra-loose", label: "Extra loose" },
  { id: "slim-fitting", label: "Slim fitting" },
  { id: "soft-feel", label: "Soft feel" },
  { id: "heavy-look", label: "Heavy look" },
];

function labelFrom(options, id) {
  if (!id || typeof id !== "string") return null;
  const hit = options.find((o) => o.id === id);
  return hit ? hit.label : null;
}

function labelsFromIds(options, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const labels = ids.map((id) => labelFrom(options, id)).filter(Boolean);
  return labels.length ? labels.join(", ") : null;
}

function measurementNumbers(m) {
  const src = m && typeof m === "object" && !Array.isArray(m) ? m : {};
  const pick = (key) => {
    const v = src[key];
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  return {
    chest: pick("chest"),
    shoulder: pick("shoulder"),
    waist: pick("waist"),
    neck: pick("neck"),
    armLength: pick("armLength"),
    sleeveLength: pick("sleeveLength"),
  };
}

function resolveCustomerId(authUser) {
  return resolveCustomerIdForChat(authUser);
}

/**
 * @param {{
 *   customerInfo: { name?: string; phone?: string };
 *   selectedGarmentType: string;
 *   customGarmentType?: string;
 *   measurements: Record<string, unknown>;
 *   styleOptions: { fit?: string; fabric?: string; style?: string[] };
 *   designBrief: { designNotes?: string; occasion?: string[]; urgency?: string; instructions?: string[]; deliveryDate?: string };
 *   selectedNeck: string;
 *   authUser?: object | null;
 * }} input
 */
export function buildMeasurementOrderPayload(input) {
  const {
    customerInfo,
    selectedGarmentType,
    customGarmentType,
    measurements,
    styleOptions,
    designBrief,
    selectedNeck,
    authUser,
  } = input;

  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const customerId = resolveCustomerId(authUser);

  const garmentLabel = garmentDisplayFromWizardPayload({
    selectedGarmentType,
    customGarmentType,
  });

  const so = styleOptions && typeof styleOptions === "object" ? styleOptions : {};
  const db = designBrief && typeof designBrief === "object" ? designBrief : {};

  const stylePreference =
    labelsFromIds(STYLE_PREFERENCE_OPTIONS, Array.isArray(so.style) ? so.style : []) || null;

  const occasion =
    labelsFromIds(OCCASION_OPTIONS, Array.isArray(db.occasion) ? db.occasion : []) || null;

  const urgency =
    labelFrom(URGENCY_OPTIONS, db.urgency) ?? labelFrom(URGENCY_OPTIONS, "normal") ?? "Normal";

  const specialInstructions =
    labelsFromIds(SPECIAL_INSTRUCTION_OPTIONS, Array.isArray(db.instructions) ? db.instructions : []) ||
    null;

  const designNote =
    typeof db.designNotes === "string" && db.designNotes.trim() ? db.designNotes.trim() : null;

  const deliveryDateRaw = typeof db.deliveryDate === "string" ? db.deliveryDate.trim() : "";
  const dueDate =
    /^\d{4}-\d{2}-\d{2}$/.test(deliveryDateRaw) ? deliveryDateRaw : null;

  return {
    orderId,
    customer: {
      id: customerId,
      name: String(customerInfo?.name ?? "").trim() || "Customer",
      phone: String(customerInfo?.phone ?? "").trim() || null,
    },
    garment: {
      type: garmentLabel === "—" ? "Custom garment" : garmentLabel,
      category: String(selectedGarmentType || "").trim() || "unknown",
    },
    measurements: measurementNumbers(measurements),
    style: {
      fitType: labelFrom(FIT_TYPE_OPTIONS, so.fit) || null,
      fabricType: labelFrom(FABRIC_TYPE_OPTIONS, so.fabric) || null,
      stylePreference,
      neckStyle: labelFrom(NECK_OPTIONS, selectedNeck) || null,
    },
    notes: {
      occasion,
      urgency,
      specialInstructions,
      designNote,
      deliveryDate: dueDate,
    },
    status: workflowStages[0]?.status || "order_placed",
    createdAt,
    /** Must match the tailor id used on `/tailor` dashboard (same as GET /orders/tailor/:id). */
    tailorId: resolveTailorIdForCustomerChat(authUser) || dashboardDefaultTailorId,
    dueDate,
  };
}

/**
 * Body for REST backends (flat fields + nested snapshot for DBs that store JSON).
 * @param {ReturnType<typeof buildMeasurementOrderPayload>} orderPayload
 */
export function measurementOrderPayloadToServerBody(orderPayload) {
  return {
    orderId: orderPayload.orderId,
    customerName: orderPayload.customer.name,
    customerId: orderPayload.customer.id,
    customerPhone: orderPayload.customer.phone,
    garmentType: orderPayload.garment.type,
    garmentCategory: orderPayload.garment.category,
    measurements: orderPayload.measurements,
    style: orderPayload.style,
    notes: orderPayload.notes,
    status: orderPayload.status,
    createdAt: orderPayload.createdAt,
    tailorId: orderPayload.tailorId,
    price: 0,
    dueDate: orderPayload.dueDate ?? null,
    source: "measurement_wizard",
    /** Full structured payload for APIs that persist a single document */
    orderPayload,
  };
}
