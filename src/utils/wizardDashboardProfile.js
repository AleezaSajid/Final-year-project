/**
 * Maps Measurement Wizard snapshot payload → dashboard profile rows.
 * Option lists mirror MeasurementWizard.jsx (keep in sync when wizard options change).
 */

const NECK_OPTIONS = [
  { id: "round", label: "Round" },
  { id: "v-neck", label: "V-Neck" },
  { id: "collar", label: "Collar" },
  { id: "boat", label: "Boat" },
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

/** Order matches customer dashboard “Measurement” accordion */
const MEASUREMENT_ROW_DEFS = [
  { key: "chest", label: "Chest" },
  { key: "shoulder", label: "Shoulder" },
  { key: "waist", label: "Waist" },
  { key: "neck", label: "Neck" },
  { key: "armLength", label: "Arm Length" },
  { key: "sleeveLength", label: "Sleeve Length" },
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

/**
 * @returns {{ measurement: { label: string; value: string | null; unit?: string }[]; styleOptions: { label: string; value: string | null }[]; notes: { label: string; value: string | null }[] }}
 */
export function buildDashboardProfileRows(payload) {
  const m =
    payload?.measurements && typeof payload.measurements === "object" && !Array.isArray(payload.measurements)
      ? payload.measurements
      : {};
  const so =
    payload?.styleOptions && typeof payload.styleOptions === "object" && !Array.isArray(payload.styleOptions)
      ? payload.styleOptions
      : {};
  const db =
    payload?.designBrief && typeof payload.designBrief === "object" && !Array.isArray(payload.designBrief)
      ? payload.designBrief
      : {};
  const selectedNeck = typeof payload?.selectedNeck === "string" ? payload.selectedNeck : "";

  const measurement = MEASUREMENT_ROW_DEFS.map(({ key, label }) => {
    const raw = m[key];
    const val = raw == null ? "" : String(raw).trim();
    return val ? { label, value: val, unit: "in" } : { label, value: null };
  });

  const fit = labelFrom(FIT_TYPE_OPTIONS, so.fit);
  const fabric = labelFrom(FABRIC_TYPE_OPTIONS, so.fabric);
  const styles = labelsFromIds(STYLE_PREFERENCE_OPTIONS, Array.isArray(so.style) ? so.style : []);
  const neckStyle = labelFrom(NECK_OPTIONS, selectedNeck);

  const styleOptions = [
    { label: "Fit Type", value: fit || null },
    { label: "Fabric Type", value: fabric || null },
    { label: "Style Preference", value: styles || null },
    { label: "Neck Style", value: neckStyle || null },
  ];

  const occasions = labelsFromIds(OCCASION_OPTIONS, Array.isArray(db.occasion) ? db.occasion : []);
  const urgency =
    labelFrom(URGENCY_OPTIONS, db.urgency) ?? labelFrom(URGENCY_OPTIONS, "normal") ?? null;
  const instructions = labelsFromIds(
    SPECIAL_INSTRUCTION_OPTIONS,
    Array.isArray(db.instructions) ? db.instructions : []
  );
  const designNote =
    typeof db.designNotes === "string" && db.designNotes.trim() ? db.designNotes.trim() : null;

  const notes = [
    { label: "Occasion", value: occasions || null },
    { label: "Urgency", value: urgency },
    { label: "Special Instructions", value: instructions || null },
    { label: "Design Note", value: designNote },
  ];

  return { measurement, styleOptions, notes };
}

function coalesceSnapshotValue(...candidates) {
  for (const v of candidates) {
    if (v == null) continue;
    if (typeof v === "string") {
      if (v.trim() !== "") return v;
      continue;
    }
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "boolean") return v;
    if (Array.isArray(v) && v.length > 0) return v;
    if (typeof v === "object" && Object.keys(v).length > 0) return v;
  }
  return undefined;
}

function mergeOrderSubobjects(preferred, fallback) {
  const a = preferred && typeof preferred === "object" && !Array.isArray(preferred) ? preferred : {};
  const b = fallback && typeof fallback === "object" && !Array.isArray(fallback) ? fallback : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  for (const k of keys) {
    const v = coalesceSnapshotValue(a[k], b[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function collectPayloadLayers(order) {
  if (!order || typeof order !== "object") return [];
  const layers = [order];
  const p = order.orderPayload;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    layers.push(p);
    const p2 = p.orderPayload;
    if (p2 && typeof p2 === "object" && !Array.isArray(p2)) layers.push(p2);
  }
  return layers;
}

function mergeLayeredField(order, key) {
  let acc = {};
  for (const layer of collectPayloadLayers(order)) {
    const chunk = layer[key];
    if (chunk && typeof chunk === "object" && !Array.isArray(chunk)) {
      acc = mergeOrderSubobjects(acc, chunk);
    }
  }
  return acc;
}

/** Merge wizard-shaped fields from every payload layer (root + orderPayload + nested). */
function mergeWizardChunksFromOrder(order) {
  let styleOptions = {};
  let designBrief = {};
  let selectedNeck = "";
  for (const layer of collectPayloadLayers(order)) {
    if (!layer || typeof layer !== "object") continue;
    const so = layer.styleOptions;
    if (so && typeof so === "object" && !Array.isArray(so)) {
      styleOptions = { ...styleOptions, ...so };
    }
    const db = layer.designBrief;
    if (db && typeof db === "object" && !Array.isArray(db)) {
      designBrief = { ...designBrief, ...db };
    }
    if (typeof layer.selectedNeck === "string" && layer.selectedNeck.trim()) {
      selectedNeck = layer.selectedNeck.trim();
    }
  }
  const hasWizard =
    Object.keys(styleOptions).length > 0 ||
    Object.keys(designBrief).length > 0 ||
    selectedNeck !== "";
  if (!hasWizard) return null;
  return {
    measurements: mergeLayeredField(order, "measurements"),
    styleOptions,
    designBrief,
    selectedNeck,
  };
}

function profileRowsAllEmpty(rows) {
  if (!Array.isArray(rows)) return true;
  return rows.every((r) => r.value == null || String(r.value).trim() === "");
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function strOrJoinNoteField(v) {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const s = v.map((x) => String(x).trim()).filter(Boolean).join(", ");
    return s === "" ? null : s;
  }
  return strOrNull(v);
}

/**
 * Map a fetched order document → dashboard profile rows (measurements, style options, notes).
 * Merges root + orderPayload (+ nested payload) and falls back to wizard-shaped fields when needed.
 */
export function buildDashboardProfileRowsFromOrder(order) {
  if (!order || typeof order !== "object") {
    return buildDashboardProfileRows(null);
  }

  const m = mergeLayeredField(order, "measurements");
  let measurement = MEASUREMENT_ROW_DEFS.map(({ key, label }) => {
    const raw = m[key];
    const val = raw == null ? "" : String(raw).trim();
    return val ? { label, value: val, unit: "in" } : { label, value: null };
  });

  const st = mergeLayeredField(order, "style");
  const fit = strOrNull(st.fitType) || strOrNull(st.fit);
  const fabric = strOrNull(st.fabricType) || strOrNull(st.fabric);
  let stylePref = strOrNull(st.stylePreference);
  if (!stylePref && Array.isArray(st.style)) {
    stylePref = st.style.map((x) => String(x).trim()).filter(Boolean).join(", ") || null;
  }
  if (!stylePref) stylePref = strOrNull(st.style);
  const neck = strOrNull(st.neckStyle) || strOrNull(st.neck);

  let styleOptions = [
    { label: "Fit Type", value: fit },
    { label: "Fabric Type", value: fabric },
    { label: "Style Preference", value: stylePref },
    { label: "Neck Style", value: neck },
  ];

  const n = mergeLayeredField(order, "notes");
  const occasion = strOrJoinNoteField(n.occasion);
  const urgency = strOrNull(n.urgency);
  const specialInstructions =
    strOrJoinNoteField(n.specialInstructions) ||
    strOrJoinNoteField(n.instructions) ||
    strOrNull(n.instruction);
  const designNote = strOrNull(n.designNote) || strOrNull(n.designNotes);

  let notes = [
    { label: "Occasion", value: occasion },
    { label: "Urgency", value: urgency },
    { label: "Special Instructions", value: specialInstructions },
    { label: "Design Note", value: designNote },
  ];

  const wizardLike = mergeWizardChunksFromOrder(order);
  if (wizardLike) {
    const fromWizard = buildDashboardProfileRows(wizardLike);
    if (profileRowsAllEmpty(styleOptions)) styleOptions = fromWizard.styleOptions;
    if (profileRowsAllEmpty(notes)) notes = fromWizard.notes;
    if (profileRowsAllEmpty(measurement)) measurement = fromWizard.measurement;
  }

  return { measurement, styleOptions, notes };
}
