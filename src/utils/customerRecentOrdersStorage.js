/**
 * Garment display label for wizard payload (shared by dashboard profile + order builder).
 * Option ids mirror MeasurementWizard.jsx.
 */

const GARMENT_TYPE_LABELS = {
  shirt: "Shirt",
  suit: "Suit",
  kurta: "Kurta",
  dress: "Dress",
  trouser: "Trouser",
  others: "Others",
};

/**
 * @param {{ selectedGarmentType?: string; customGarmentType?: string }} payload
 */
export function garmentDisplayFromWizardPayload(payload) {
  if (!payload || typeof payload !== "object") return "—";
  const id = typeof payload.selectedGarmentType === "string" ? payload.selectedGarmentType : "";
  if (id === "others") {
    const custom = String(payload.customGarmentType ?? "").trim();
    return custom || "Custom garment";
  }
  if (id && GARMENT_TYPE_LABELS[id]) return GARMENT_TYPE_LABELS[id];
  if (id) return id;
  return "—";
}
