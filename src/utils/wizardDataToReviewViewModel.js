/**
 * Maps the full measurement wizard state object (unfiltered) into the same view shape
 * used by {@link WizardOrderReviewModal} — single source, no per-field API payload.
 */

const GARMENT_TYPE_OPTIONS = [
  { id: "shirt", label: "Shirt" },
  { id: "suit", label: "Suit" },
  { id: "kurta", label: "Kurta" },
  { id: "dress", label: "Dress" },
  { id: "trouser", label: "Trouser" },
  { id: "others", label: "Others" },
];
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

function labelOf(options, id) {
  if (id == null || id === "") return "";
  const hit = options.find((o) => o.id === id);
  return hit ? hit.label : String(id);
}

function labelsFromIds(options, ids) {
  if (!Array.isArray(ids) || !ids.length) return "";
  const labels = ids.map((i) => labelOf(options, i)).filter(Boolean);
  return labels.length ? labels.join(", ") : "";
}

/**
 * @param {Record<string, unknown>} wizardData full wizard state
 * @param {Record<string, unknown>} order normalized order (for ids / dates)
 */
export function buildViewModelFromFullWizardData(wizardData, order = {}) {
  const wd = wizardData && typeof wizardData === "object" && !Array.isArray(wizardData) ? wizardData : {};
  const ci = wd.customerInfo && typeof wd.customerInfo === "object" ? wd.customerInfo : {};
  const so = wd.styleOptions && typeof wd.styleOptions === "object" ? wd.styleOptions : {};
  const db = wd.designBrief && typeof wd.designBrief === "object" ? wd.designBrief : {};
  const meas = wd.measurements && typeof wd.measurements === "object" && !Array.isArray(wd.measurements) ? { ...wd.measurements } : {};

  const garmentOpt = GARMENT_TYPE_OPTIONS.find((g) => g.id === wd.selectedGarmentType);
  const garmentLabel = garmentOpt
    ? garmentOpt.label
    : typeof wd.selectedGarmentType === "string"
      ? wd.selectedGarmentType
      : "—";
  const custom =
    wd.selectedGarmentType === "others" && String(wd.customGarmentType ?? "").trim()
      ? String(wd.customGarmentType).trim()
      : "";
  const garmentType = custom ? `${garmentLabel} (${custom})` : garmentLabel;

  const style = {
    fitType: labelOf(FIT_TYPE_OPTIONS, so.fit) || (so.fit != null ? String(so.fit) : ""),
    fabricType: labelOf(FABRIC_TYPE_OPTIONS, so.fabric) || (so.fabric != null ? String(so.fabric) : ""),
    stylePreference: labelsFromIds(STYLE_PREFERENCE_OPTIONS, Array.isArray(so.style) ? so.style : []),
    neckStyle: labelOf(NECK_OPTIONS, wd.selectedNeck) || (wd.selectedNeck != null ? String(wd.selectedNeck) : ""),
  };

  const occasion = labelsFromIds(OCCASION_OPTIONS, Array.isArray(db.occasion) ? db.occasion : []);
  const urgency = labelOf(URGENCY_OPTIONS, db.urgency) || (db.urgency != null ? String(db.urgency) : "");
  const specialInstructions = labelsFromIds(
    SPECIAL_INSTRUCTION_OPTIONS,
    Array.isArray(db.instructions) ? db.instructions : []
  );

  const notes = {
    deliveryDate: db.deliveryDate != null ? String(db.deliveryDate) : "",
    occasion,
    urgency,
    specialInstructions,
    designNote: typeof db.designNotes === "string" ? db.designNotes : "",
  };

  const image = wd?.image || wd?.referenceImage?.dataUrl || null;

  return {
    customerName: String(ci.name ?? "").trim() || "—",
    customerPhone: String(ci.phone ?? "").trim(),
    customerId: String(order?.customerId ?? "").trim(),
    garmentType: garmentType || "—",
    garmentCategory: String(wd.selectedGarmentType ?? "").trim(),
    measurements: meas,
    style,
    notes,
    image,
    wizardOrderId: String(order?.clientOrderId ?? order?.orderId ?? "").trim(),
    createdAt: order?.createdAt ?? order?.date ?? "",
    hasPayload: true,
    fromFullWizardData: true,
    /** Non-order fields for extra DetailRows in modal */
    fullWizardMeta: {
      activeStep: wd.activeStep,
      draftVersion: wd.draftVersion,
      orderType: ci.orderType,
      address: ci.address,
      customerOrderNotes: ci.notes,
      hasReferenceImage: Boolean(wd.referenceImage?.dataUrl),
      referenceImageName: wd.referenceImage?.name,
      extraData: wd.data,
    },
  };
}
