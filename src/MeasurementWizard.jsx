import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import WizardNavbar from "./components/WizardNavbar";
import { saveWizardDraft, loadWizardDraft } from "./api/wizardDraftApi";
import { putWizardDraft, putCustomerMeta } from "./api/accountApi.js";
import { createWizardDraftOrder } from "./api/wizardDraftOrderApi.js";
import { useAuth } from "./context/AuthContext.jsx";
import {
  clearLinkedWizardOrderId,
  getLinkedWizardOrderId,
  hydrateLinkedOrderIdFromDraft,
  isWizardFreshStart,
  shouldRestoreWizardLinkedOrderId,
  startWizardFresh,
  syncWizardOrderToServer,
} from "./utils/measurementWizardOrderSync.js";
import { resolveOrderCustomerId } from "./utils/measurementOrderPayload.js";
import {
  clearCustomerTailorShopSession,
  looksLikeTailorShopId,
  isPlaceholderTailorShopId,
  persistCustomerTailorShopSession,
} from "./utils/chatIdentity.js";

/** Browse/map navigation may send shop id under different keys. */
function pickBrowseTailorShopIdFromState(bt) {
  if (!bt || typeof bt !== "object") return "";
  for (const key of ["tailorShopId", "shopId", "tailorId", "id"]) {
    const raw = bt[key];
    if (raw == null) continue;
    const s = String(raw).trim();
    if (s && looksLikeTailorShopId(s)) return s;
  }
  return "";
}

const WIZARD_STEPS = [
  { id: 1, title: "Customer Info", component: "CustomerInfo" },
  { id: 2, title: "Garment Type", component: "GarmentType" },
  { id: 3, title: "Body Measurements", component: "BodyMeasurements" },
  { id: 4, title: "Style Options", component: "StyleOptions" },
  { id: 5, title: "Design Notes", component: "DesignNotes" },
  { id: 6, title: "Review", component: "Review" },
];

/** Assistant-style narration (keyed by activeStep; aligned to wizard step order) */
const stepGuidance = {
  1: "Let's start simple — basic profile details help us personalize your fit.",
  2: "Choose what we're tailoring — you can add a reference to guide the cut.",
  3: "Now we'll capture key body measurements for accuracy.",
  4: "We'll fine-tune fit preferences for comfort and style.",
  5: "Almost there — add design notes and timing so we can meet your expectations.",
  6: "You're ready to confirm your custom tailoring order.",
};

/** Direction-aware step content (horizontal slide + fade); Apple-like ease-out, no blur/scale */
const MW_STEP_EASE_OUT = [0.25, 0.1, 0.25, 1];
const MW_STEP_CONTENT_DURATION = 0.42;
const MW_STEP_CONTENT_TRANSITION = {
  duration: MW_STEP_CONTENT_DURATION,
  ease: MW_STEP_EASE_OUT,
};
/** custom: 1 = forward (next), -1 = backward (previous) */
const MW_STEP_CONTENT_VARIANTS = {
  initial: (dir) => ({
    x: dir > 0 ? 18 : -18,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (dir) => ({
    x: dir > 0 ? -18 : 18,
    opacity: 0,
  }),
};

/** Progress bar: width eases over ~0.7s with slight lag after step change (no jitter) */
const MW_PROGRESS_BAR_TRANSITION = {
  duration: 0.72,
  delay: 0.1,
  ease: [0.22, 1, 0.36, 1],
};

/** Sidebar: soft Apple-like easing; active indicator pulse + glow (stable keyframe refs → no re-pulse on re-render) */
const MW_SIDEBAR_SURFACE_EASE = [0.25, 0.1, 0.25, 1];
const MW_SIDEBAR_ACTIVE_SCALE_KF = [1, 1.05, 1];
const MW_SIDEBAR_ACTIVE_SHADOW_KF = [
  "0 2px 8px rgba(0,0,0,0.10)",
  "0 0 0 2px rgba(74,124,89,0.24), 0 8px 22px -4px rgba(62,107,74,0.40)",
  "0 2px 8px rgba(0,0,0,0.10)",
];
const MW_SIDEBAR_ACTIVE_PULSE_TRANSITION = {
  scale: { duration: 0.55, times: [0, 0.42, 1], ease: MW_SIDEBAR_SURFACE_EASE },
  boxShadow: { duration: 0.55, times: [0, 0.42, 1], ease: MW_SIDEBAR_SURFACE_EASE },
};
const MW_SIDEBAR_INDICATOR_REST = {
  scale: 1,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const MW_SIDEBAR_INDICATOR_IDLE = {
  scale: 1,
  boxShadow: "0 0 0 0 rgba(0,0,0,0)",
};
const MW_SIDEBAR_ACTIVE_ANIMATE = {
  scale: MW_SIDEBAR_ACTIVE_SCALE_KF,
  boxShadow: MW_SIDEBAR_ACTIVE_SHADOW_KF,
};

/** Local UX-only “smart” hints (no AI; keyed by wizard step) */
const getAdaptiveHint = (activeStep, formData = {}) => {
  void formData;
  switch (activeStep) {
    case 1:
      return "Tip: Accurate basic info helps improve overall fitting accuracy.";
    case 2:
      return "Choose garment type and optional reference — it anchors how we interpret your fit.";
    case 3:
      return "Make sure measurements are taken in a relaxed standing position.";
    case 4:
      return "Comfort preference affects final garment feel — choose carefully.";
    case 5:
      return "We are validating your inputs for consistency.";
    case 6:
      return "Review carefully — small changes can impact final fit.";
    default:
      return "";
  }
};

const NECK_OPTIONS = [
  { id: "round", label: "Round" },
  { id: "v-neck", label: "V-Neck" },
  { id: "collar", label: "Collar" },
  { id: "boat", label: "Boat" },
];

const initialMeasurements = {
  chest: "",
  waist: "",
  shoulder: "",
  neck: "",
  armLength: "",
  sleeveLength: "",
};

const BODY_MEASUREMENT_KEYS = ["chest", "waist", "shoulder", "neck", "armLength", "sleeveLength"];

const NECK_IDS = new Set(NECK_OPTIONS.map((o) => o.id));

const GARMENT_TYPE_OPTIONS = [
  { id: "shirt", label: "Shirt", subtitle: "Formal & casual shirts", emoji: "👕" },
  { id: "suit", label: "Suit", subtitle: "Tailored suits & blazers", emoji: "🤵" },
  { id: "kurta", label: "Kurta", subtitle: "Traditional kurta & kameez", emoji: "👘" },
  { id: "dress", label: "Dress", subtitle: "Dresses & gowns", emoji: "👗" },
  { id: "trouser", label: "Trouser", subtitle: "Pants & trousers", emoji: "👖" },
  { id: "others", label: "Others", subtitle: "Specify a custom garment", emoji: "✏️" },
];

const GARMENT_TYPE_IDS = new Set(GARMENT_TYPE_OPTIONS.map((o) => o.id));

const FIT_TYPE_OPTIONS = [
  { id: "slim", label: "Slim Fit" },
  { id: "regular", label: "Regular Fit" },
  { id: "loose", label: "Loose Fit" },
];

const FABRIC_TYPE_OPTIONS = [
  { id: "cotton", label: "Cotton", hint: "Breathable & versatile" },
  { id: "linen", label: "Linen", hint: "Light, airy drape" },
  { id: "wool", label: "Wool", hint: "Warmth & structure" },
  { id: "silk", label: "Silk", hint: "Luxurious sheen" },
];

const STYLE_PREFERENCE_OPTIONS = [
  { id: "formal", label: "Formal" },
  { id: "casual", label: "Casual" },
  { id: "traditional", label: "Traditional" },
  { id: "modern", label: "Modern" },
];

const FIT_TYPE_IDS = new Set(FIT_TYPE_OPTIONS.map((o) => o.id));
const FABRIC_TYPE_IDS = new Set(FABRIC_TYPE_OPTIONS.map((o) => o.id));
const STYLE_PREFERENCE_IDS = new Set(STYLE_PREFERENCE_OPTIONS.map((o) => o.id));

const initialStyleOptions = {
  fit: "",
  fabric: "",
  style: [],
};

function mergeStyleOptions(raw) {
  const base = { ...initialStyleOptions };
  if (!raw || typeof raw !== "object") return base;
  const fit = typeof raw.fit === "string" && FIT_TYPE_IDS.has(raw.fit) ? raw.fit : "";
  const fabric = typeof raw.fabric === "string" && FABRIC_TYPE_IDS.has(raw.fabric) ? raw.fabric : "";
  let style = [];
  if (Array.isArray(raw.style)) {
    style = raw.style.filter((s) => typeof s === "string" && STYLE_PREFERENCE_IDS.has(s));
  }
  return { fit, fabric, style };
}

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

const OCCASION_IDS = new Set(OCCASION_OPTIONS.map((o) => o.id));
const URGENCY_IDS = new Set(URGENCY_OPTIONS.map((o) => o.id));
const SPECIAL_INSTRUCTION_IDS = new Set(SPECIAL_INSTRUCTION_OPTIONS.map((o) => o.id));

const initialDesignBrief = {
  designNotes: "",
  occasion: [],
  urgency: "normal",
  instructions: [],
};

function mergeDesignBrief(raw) {
  const base = { ...initialDesignBrief };
  if (!raw || typeof raw !== "object") return base;
  const designNotes = typeof raw.designNotes === "string" ? raw.designNotes : "";
  let occasion = [];
  if (Array.isArray(raw.occasion)) {
    occasion = raw.occasion.filter((s) => typeof s === "string" && OCCASION_IDS.has(s));
  }
  const urgencyRaw = raw.urgency;
  const urgency =
    typeof urgencyRaw === "string" && URGENCY_IDS.has(urgencyRaw) ? urgencyRaw : base.urgency;
  let instructions = [];
  if (Array.isArray(raw.instructions)) {
    instructions = raw.instructions.filter((s) => typeof s === "string" && SPECIAL_INSTRUCTION_IDS.has(s));
  }
  return { designNotes, occasion, urgency, instructions };
}

const initialWizardData = {};

const initialCustomerInfo = {
  name: "",
  phone: "",
  address: "",
  orderType: "pickup",
  notes: "",
};

function mergeCustomerInfo(raw) {
  const base = { ...initialCustomerInfo };
  if (!raw || typeof raw !== "object") return base;
  const orderRaw = raw.orderType;
  const orderType =
    orderRaw === "delivery" || orderRaw === "pickup" ? orderRaw : base.orderType;
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    phone: typeof raw.phone === "string" ? raw.phone : "",
    address: typeof raw.address === "string" ? raw.address : "",
    orderType,
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

function mergeWizardData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...initialWizardData };
  return { ...initialWizardData, ...raw };
}

function buildInitialStateFromDraftPayload(saved) {
  let activeStep = 3;
  let selectedNeck = "v-neck";
  let measurements = { ...initialMeasurements };
  let data = { ...initialWizardData };
  let draftVersion = 0;
  let selectedGarmentType = "";
  let customGarmentType = "";
  let referenceImage = null;
  let customerInfo = { ...initialCustomerInfo };
  let styleOptions = { ...initialStyleOptions };
  let designBrief = { ...initialDesignBrief };

  if (saved) {
    if (typeof saved.activeStep === "number" && saved.activeStep >= 1 && saved.activeStep <= 6) {
      activeStep = saved.activeStep;
    }
    const rawGarment =
      typeof saved.selectedGarmentType === "string"
        ? saved.selectedGarmentType
        : saved.data && typeof saved.data.selectedGarmentType === "string"
          ? saved.data.selectedGarmentType
          : "";
    if (rawGarment && GARMENT_TYPE_IDS.has(rawGarment)) {
      selectedGarmentType = rawGarment;
    }
    if (typeof saved.customGarmentType === "string") {
      customGarmentType = saved.customGarmentType;
    } else if (saved.data && typeof saved.data.customGarmentType === "string") {
      customGarmentType = saved.data.customGarmentType;
    }
    const rawRef = saved.referenceImage;
    if (
      rawRef &&
      typeof rawRef === "object" &&
      typeof rawRef.name === "string" &&
      typeof rawRef.dataUrl === "string" &&
      rawRef.dataUrl.startsWith("data:image/")
    ) {
      referenceImage = { name: rawRef.name, dataUrl: rawRef.dataUrl };
    }
    if (typeof saved.selectedNeck === "string" && NECK_IDS.has(saved.selectedNeck)) {
      selectedNeck = saved.selectedNeck;
    }
    if (saved.measurements && typeof saved.measurements === "object") {
      measurements = { ...initialMeasurements };
      for (const key of BODY_MEASUREMENT_KEYS) {
        if (Object.prototype.hasOwnProperty.call(saved.measurements, key)) {
          const val = saved.measurements[key];
          measurements[key] = val == null ? "" : String(val);
        }
      }
    }
    data = mergeWizardData(saved.data);
    if (typeof saved.draftVersion === "number" && saved.draftVersion >= 0 && Number.isFinite(saved.draftVersion)) {
      draftVersion = Math.floor(saved.draftVersion);
    }
    if (saved.customerInfo && typeof saved.customerInfo === "object") {
      customerInfo = mergeCustomerInfo(saved.customerInfo);
    }
    if (saved.styleOptions && typeof saved.styleOptions === "object") {
      styleOptions = mergeStyleOptions(saved.styleOptions);
    }
    if (saved.designBrief && typeof saved.designBrief === "object") {
      designBrief = mergeDesignBrief(saved.designBrief);
    }
  }

  let assignedTailorShopId = "";
  if (saved && typeof saved.assignedTailorShopId === "string" && saved.assignedTailorShopId.trim()) {
    assignedTailorShopId = saved.assignedTailorShopId.trim();
  }
  let assignedTailorDisplayName = "";
  if (saved && typeof saved.assignedTailorDisplayName === "string" && saved.assignedTailorDisplayName.trim()) {
    assignedTailorDisplayName = saved.assignedTailorDisplayName.trim();
  }

  return {
    activeStep,
    customerInfo,
    selectedGarmentType,
    customGarmentType,
    referenceImage,
    selectedNeck,
    measurements,
    data,
    draftVersion,
    styleOptions,
    designBrief,
    assignedTailorShopId,
    assignedTailorDisplayName,
  };
}

const initialWizardFromDraft = buildInitialStateFromDraftPayload(null);

const inputShell =
  "relative flex w-full items-center overflow-hidden rounded-xl border border-white/55 bg-white/55 pl-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md transition focus-within:border-[#3b6b52]/50 focus-within:bg-white/75 focus-within:shadow-[0_0_0_3px_rgba(31,61,43,0.14)]";

const inputField =
  "min-w-0 flex-1 bg-transparent py-2.5 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400";

/** Matches SewServeLandingPage "Book a Fitting" (hero-cta) — gradient, lift, brightness, shine layer */
const MW_HERO_CTA_CORE =
  "mw-hero-cta relative overflow-hidden bg-gradient-to-b from-[#2a5240] to-[#1f3d2b] font-semibold text-white shadow-none transition duration-300 hover:-translate-y-1 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/45 focus-visible:ring-offset-2";

const MW_PRIMARY_CTA = `${MW_HERO_CTA_CORE} rounded-xl`;

const MW_GLASS_OPTION =
  "rounded-xl border border-white/40 bg-white/30 text-slate-700 backdrop-blur-md transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30 focus-visible:ring-offset-2";

const MW_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/25 px-8 py-3.5 text-base font-semibold text-slate-700 backdrop-blur-md transition duration-300 hover:bg-white/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30 focus-visible:ring-offset-2";

function BodyMeasurementsStep({
  measurements,
  updateMeasurement,
  selectedNeck,
  setSelectedNeck,
  onFieldFocus,
  onFieldBlur,
}) {
  return (
    <>
      <div className="border-b border-white/15 pb-6 text-center sm:text-left">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Body Measurements</h2>
        <p className="mt-1 text-xs text-slate-500">Enter values in inches</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
        {[
          { key: "chest", label: "Chest" },
          { key: "waist", label: "Waist" },
          { key: "shoulder", label: "Shoulder" },
          { key: "neck", label: "Neck" },
          { key: "armLength", label: "Arm Length" },
          { key: "sleeveLength", label: "Sleeve Length" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`m-${key}`} className="text-sm font-medium text-slate-700">
              {label}
            </label>
            <div className={`${inputShell} mt-1.5`}>
              <input
                id={`m-${key}`}
                type="text"
                inputMode="decimal"
                placeholder="in Inches"
                value={measurements[key]}
                onChange={(e) => updateMeasurement(key, e.target.value)}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
                className={inputField}
              />
              <span className="border-l border-white/40 bg-white/25 px-3 py-2.5 text-xs font-medium text-slate-500 backdrop-blur-sm">
                in
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <p className="text-sm font-semibold text-slate-800">Select Neck Style</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NECK_OPTIONS.map((opt) => {
            const selected = selectedNeck === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedNeck(opt.id)}
                className={`w-full px-3 py-3 text-center text-sm ${
                  selected ? `${MW_PRIMARY_CTA} border border-transparent` : MW_GLASS_OPTION
                }`}
              >
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function StyleOptionsStep({ styleOptions, setStyleOptions }) {
  const toggleStylePref = (id) => {
    setStyleOptions((prev) => {
      const next = new Set(prev.style);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, style: Array.from(next) };
    });
  };

  return (
    <>
      <div className="border-b border-white/15 pb-6 text-center sm:text-left">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Style Options</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tailor the silhouette, material feel, and overall aesthetic
        </p>
      </div>

      <section className="mt-8">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Fit type</h3>
        <p className="mt-1 text-xs text-slate-500">Select one fit profile</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIT_TYPE_OPTIONS.map((opt) => {
            const selected = styleOptions.fit === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStyleOptions((prev) => ({ ...prev, fit: opt.id }))}
                className={`w-full p-4 text-left ${
                  selected ? `${MW_PRIMARY_CTA} border border-transparent` : MW_GLASS_OPTION
                }`}
              >
                <span className="relative z-10 flex flex-col">
                  <span
                    className={`text-base font-semibold ${selected ? "text-white" : "text-slate-900"}`}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs font-medium ${
                      selected ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {opt.id === "slim" && "Close, tailored silhouette"}
                    {opt.id === "regular" && "Balanced comfort and shape"}
                    {opt.id === "loose" && "Relaxed drape and ease"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Fabric type</h3>
        <p className="mt-1 text-xs text-slate-500">Choose your preferred material</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FABRIC_TYPE_OPTIONS.map((opt) => {
            const selected = styleOptions.fabric === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStyleOptions((prev) => ({ ...prev, fabric: opt.id }))}
                className={`w-full p-4 text-left ${
                  selected ? `${MW_PRIMARY_CTA} border border-transparent` : MW_GLASS_OPTION
                }`}
              >
                <span className="relative z-10 flex flex-col">
                  <span
                    className={`text-base font-semibold ${selected ? "text-white" : "text-slate-900"}`}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs font-medium ${
                      selected ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {opt.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Style preferences</h3>
        <p className="mt-1 text-xs text-slate-500">Select all that apply</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {STYLE_PREFERENCE_OPTIONS.map((opt) => {
            const active = styleOptions.style.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleStylePref(opt.id)}
                className={`px-5 py-2.5 text-sm font-semibold ${
                  active
                    ? `${MW_HERO_CTA_CORE} rounded-full border border-transparent`
                    : `${MW_GLASS_OPTION} rounded-full`
                }`}
              >
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function DesignNotesStep({ designBrief, setDesignBrief, onFieldFocus, onFieldBlur }) {
  const toggleOccasion = (id) => {
    setDesignBrief((prev) => {
      const next = new Set(prev.occasion);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, occasion: Array.from(next) };
    });
  };

  const toggleInstruction = (id) => {
    setDesignBrief((prev) => {
      const next = new Set(prev.instructions);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, instructions: Array.from(next) };
    });
  };

  return (
    <>
      <div className="border-b border-white/15 pb-6 text-center sm:text-left">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Design Notes</h2>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Describe your vision for the garment
        </p>
      </div>

      <div className="mt-8">
        <label htmlFor="design-notes-main" className="text-sm font-semibold text-slate-800">
          Your brief
        </label>
        <textarea
          id="design-notes-main"
          rows={9}
          value={designBrief.designNotes}
          onChange={(e) =>
            setDesignBrief((prev) => ({ ...prev, designNotes: e.target.value }))
          }
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
          placeholder="Describe design details, inspiration, stitching preferences, or anything you want your tailor to know..."
          className="mt-2 min-h-[12rem] w-full resize-y rounded-xl border border-white/55 bg-white/55 px-3 py-3 text-sm leading-relaxed text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md transition placeholder:text-slate-400 focus:border-[#3b6b52]/50 focus:bg-white/75 focus:outline-none focus:shadow-[0_0_0_3px_rgba(31,61,43,0.14)]"
        />
      </div>

      <section className="mt-10">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Occasion</h3>
        <p className="mt-1 text-xs text-slate-500">Select all that apply</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {OCCASION_OPTIONS.map((opt) => {
            const active = designBrief.occasion.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleOccasion(opt.id)}
                className={`px-5 py-2.5 text-sm font-semibold ${
                  active
                    ? `${MW_HERO_CTA_CORE} rounded-full border border-transparent`
                    : `${MW_GLASS_OPTION} rounded-full`
                }`}
              >
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Urgency</h3>
        <p className="mt-1 text-xs text-slate-500">How soon do you need this?</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-2xl">
          {URGENCY_OPTIONS.map((opt) => {
            const selected = designBrief.urgency === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setDesignBrief((prev) => ({ ...prev, urgency: opt.id }))
                }
                className={`w-full px-4 py-3 text-center text-sm font-semibold ${
                  selected ? `${MW_PRIMARY_CTA} border border-transparent` : MW_GLASS_OPTION
                }`}
              >
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Special instructions</h3>
        <p className="mt-1 text-xs text-slate-500">Fit &amp; feel cues — select all that apply</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {SPECIAL_INSTRUCTION_OPTIONS.map((opt) => {
            const active = designBrief.instructions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleInstruction(opt.id)}
                className={`px-5 py-2.5 text-sm font-semibold ${
                  active
                    ? `${MW_HERO_CTA_CORE} rounded-full border border-transparent`
                    : `${MW_GLASS_OPTION} rounded-full`
                }`}
              >
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

const MEASUREMENT_DISPLAY_LABELS = {
  chest: "Chest",
  waist: "Waist",
  shoulder: "Shoulder",
  neck: "Neck",
  armLength: "Arm length",
  sleeveLength: "Sleeve length",
};

function ReviewSection({ title, children }) {
  return (
    <section className="ss-glass-card rounded-2xl p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 border-t border-white/25 pt-4">{children}</div>
    </section>
  );
}

function ReviewStep({
  customerInfo,
  selectedGarmentType,
  customGarmentType,
  referenceImage,
  measurements,
  selectedNeck,
  styleOptions,
  designBrief,
}) {
  const garmentOpt = GARMENT_TYPE_OPTIONS.find((g) => g.id === selectedGarmentType);
  const garmentLabel = garmentOpt ? garmentOpt.label : selectedGarmentType || "—";
  const neckLabel = NECK_OPTIONS.find((n) => n.id === selectedNeck)?.label ?? "—";
  const fitLabel = FIT_TYPE_OPTIONS.find((f) => f.id === styleOptions.fit)?.label ?? "—";
  const fabricLabel = FABRIC_TYPE_OPTIONS.find((f) => f.id === styleOptions.fabric)?.label ?? "—";
  const stylePrefLabels = STYLE_PREFERENCE_OPTIONS.filter((o) =>
    styleOptions.style.includes(o.id)
  ).map((o) => o.label);
  const occasionLabels = OCCASION_OPTIONS.filter((o) => designBrief.occasion.includes(o.id)).map(
    (o) => o.label
  );
  const instructionLabels = SPECIAL_INSTRUCTION_OPTIONS.filter((o) =>
    designBrief.instructions.includes(o.id)
  ).map((o) => o.label);
  const urgencyLabel =
    URGENCY_OPTIONS.find((u) => u.id === designBrief.urgency)?.label ?? "—";

  const orderTypeLabel =
    customerInfo.orderType === "delivery"
      ? "Delivery"
      : customerInfo.orderType === "pickup"
        ? "Pickup"
        : "—";

  const chipReadonly =
    "inline-flex rounded-full border border-white/40 bg-white/25 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm";

  return (
    <>
      <div className="border-b border-white/15 pb-6 text-center sm:text-left">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Review your order</h2>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Confirm everything looks correct before submitting
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ReviewSection title="Customer info">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Name</dt>
              <dd className="font-medium text-slate-800">{customerInfo.name?.trim() || "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-800">{customerInfo.phone?.trim() || "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</dt>
              <dd className="font-medium text-slate-800">{customerInfo.address?.trim() || "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Order type
              </dt>
              <dd className="font-medium text-slate-800">{orderTypeLabel}</dd>
            </div>
          </dl>
        </ReviewSection>

        <ReviewSection title="Garment details">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Garment</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{garmentLabel}</p>
            </div>
            {selectedGarmentType === "others" && String(customGarmentType ?? "").trim() ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Custom</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{customGarmentType.trim()}</p>
              </div>
            ) : null}
            {referenceImage?.dataUrl ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Reference image
                </p>
                <div className="mt-2 inline-block overflow-hidden rounded-xl border border-white/40 bg-white/20 p-1 shadow-sm backdrop-blur-sm">
                  <img
                    src={referenceImage.dataUrl}
                    alt={referenceImage.name ? `Reference: ${referenceImage.name}` : "Reference upload"}
                    className="max-h-36 max-w-full rounded-lg object-contain sm:max-h-40"
                  />
                </div>
                {referenceImage.name ? (
                  <p className="mt-2 text-xs text-slate-500">{referenceImage.name}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No reference image uploaded.</p>
            )}
          </div>
        </ReviewSection>

        <ReviewSection title="Measurements">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-8">
            {BODY_MEASUREMENT_KEYS.map((key) => {
              const val = String(measurements[key] ?? "").trim();
              return (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-3 border-b border-white/20 pb-2 text-sm last:border-0 sm:border-b-0 sm:pb-0"
                >
                  <span className="text-slate-600">{MEASUREMENT_DISPLAY_LABELS[key] ?? key}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {val ? `${val} in` : "—"}
                  </span>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between gap-3 border-b border-white/20 pb-2 text-sm sm:col-span-2 sm:border-0 sm:pb-0">
              <span className="text-slate-600">Neck style</span>
              <span className="font-semibold text-slate-900">{neckLabel}</span>
            </div>
          </div>
        </ReviewSection>

        <ReviewSection title="Style options">
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Fit</span>
              <span className="text-sm font-medium text-slate-800">{fitLabel}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Fabric
              </span>
              <span className="text-sm font-medium text-slate-800">{fabricLabel}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Style preferences
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {stylePrefLabels.length ? (
                  stylePrefLabels.map((label) => (
                    <span key={label} className={chipReadonly}>
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>
            </div>
          </div>
        </ReviewSection>

        <ReviewSection title="Design notes">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {String(designBrief.designNotes ?? "").trim() ? (
                  designBrief.designNotes
                ) : (
                  <span className="italic text-slate-500">No design notes added.</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Occasion</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {occasionLabels.length ? (
                  occasionLabels.map((label) => (
                    <span key={label} className={chipReadonly}>
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Urgency
              </span>
              <span className="text-sm font-medium text-slate-800">{urgencyLabel}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Special instructions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {instructionLabels.length ? (
                  instructionLabels.map((label) => (
                    <span key={label} className={chipReadonly}>
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>
            </div>
          </div>
        </ReviewSection>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500 sm:text-left">
        Need changes? Use <span className="font-medium text-slate-600">Previous</span> or click a step
        in the sidebar.
      </p>
    </>
  );
}

export default function MeasurementWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [activeStep, setActiveStep] = useState(initialWizardFromDraft.activeStep);
  const [customerInfo, setCustomerInfo] = useState(initialWizardFromDraft.customerInfo);
  const [selectedGarmentType, setSelectedGarmentType] = useState(
    initialWizardFromDraft.selectedGarmentType
  );
  const [customGarmentType, setCustomGarmentType] = useState(
    initialWizardFromDraft.customGarmentType ?? ""
  );
  const [referenceImage, setReferenceImage] = useState(
    initialWizardFromDraft.referenceImage ?? null
  );
  const [selectedNeck, setSelectedNeck] = useState(initialWizardFromDraft.selectedNeck);
  const [measurements, setMeasurements] = useState(initialWizardFromDraft.measurements);
  const [styleOptions, setStyleOptions] = useState(initialWizardFromDraft.styleOptions);
  const [designBrief, setDesignBrief] = useState(initialWizardFromDraft.designBrief);
  const [data, setData] = useState(initialWizardFromDraft.data);
  const [draftVersion, setDraftVersion] = useState(initialWizardFromDraft.draftVersion);
  const [assignedTailorShopId, setAssignedTailorShopId] = useState(
    initialWizardFromDraft.assignedTailorShopId ?? ""
  );
  const [assignedTailorDisplayName, setAssignedTailorDisplayName] = useState(
    initialWizardFromDraft.assignedTailorDisplayName ?? ""
  );
  const [browseTailorBanner, setBrowseTailorBanner] = useState(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [error, setError] = useState("");
  const [fieldInsight, setFieldInsight] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const skipScrollOnMountRef = useRef(true);
  const browseLocationKeyHandledRef = useRef(null);
  const referenceFileInputRef = useRef(null);

  /** Only hydrate assigned tailor from wizard `data` fields — never from chat/conversation hints. */
  useEffect(() => {
    if (loading || !user) return;
    const current = String(assignedTailorShopId ?? "").trim();
    if (current && looksLikeTailorShopId(current)) return;
    const d = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const fromData = [d.selectedTailorShopId, d.tailorShopId]
      .map((v) => (v != null ? String(v).trim() : ""))
      .find((v) => v && looksLikeTailorShopId(v));
    if (!fromData) return;
    setAssignedTailorShopId(fromData);
    persistCustomerTailorShopSession(fromData);
  }, [loading, user, data, assignedTailorShopId]);

  useEffect(() => {
    if (loading) return;
    const role = user?.role ? String(user.role).trim() : "";
    if (!user || role !== "customer") {
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [loading, user, navigate, location.pathname]);

  const lastPersistedSnapshotRef = useRef(
    JSON.stringify({
      activeStep: initialWizardFromDraft.activeStep,
      customerInfo: initialWizardFromDraft.customerInfo,
      selectedGarmentType: initialWizardFromDraft.selectedGarmentType,
      customGarmentType: initialWizardFromDraft.customGarmentType,
      referenceImage: initialWizardFromDraft.referenceImage,
      selectedNeck: initialWizardFromDraft.selectedNeck,
      measurements: initialWizardFromDraft.measurements,
      styleOptions: initialWizardFromDraft.styleOptions,
      designBrief: initialWizardFromDraft.designBrief,
      data: initialWizardFromDraft.data,
      assignedTailorShopId: initialWizardFromDraft.assignedTailorShopId ?? "",
      assignedTailorDisplayName: initialWizardFromDraft.assignedTailorDisplayName ?? "",
    })
  );
  const draftHydratedUserIdRef = useRef(null);
  const wizardFreshHandledRef = useRef(false);

  const applyFreshWizardFormState = useCallback(() => {
    setActiveStep(1);
    setCustomerInfo({ ...initialCustomerInfo });
    setSelectedGarmentType("");
    setCustomGarmentType("");
    setReferenceImage(null);
    setSelectedNeck("v-neck");
    setMeasurements({ ...initialMeasurements });
    setStyleOptions({ ...initialStyleOptions });
    setDesignBrief({ ...initialDesignBrief });
    setData({ ...initialWizardData });
    setDraftVersion(0);
    setAssignedTailorShopId("");
    setAssignedTailorDisplayName("");
    setBrowseTailorBanner(null);
    setError("");
    setFieldInsight(getAdaptiveHint(1));
    setIsThinking(false);
    lastPersistedSnapshotRef.current = JSON.stringify({
      activeStep: 1,
      customerInfo: { ...initialCustomerInfo },
      selectedGarmentType: "",
      customGarmentType: "",
      referenceImage: null,
      selectedNeck: "v-neck",
      measurements: { ...initialMeasurements },
      styleOptions: { ...initialStyleOptions },
      designBrief: { ...initialDesignBrief },
      data: { ...initialWizardData },
      assignedTailorShopId: "",
      assignedTailorDisplayName: "",
    });
  }, []);

  useEffect(() => {
    if (loading || wizardFreshHandledRef.current) return;
    if (!isWizardFreshStart(location, searchParams)) return;
    if (!user?.id || user.role !== "customer") return;

    wizardFreshHandledRef.current = true;
    draftHydratedUserIdRef.current = user.id;
    startWizardFresh({ user });
    applyFreshWizardFormState();

    if (searchParams.get("fresh") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("fresh");
      const qs = next.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "" }, { replace: true, state: null });
    } else {
      navigate(".", { replace: true, state: null });
    }
  }, [
    loading,
    user,
    location,
    searchParams,
    navigate,
    applyFreshWizardFormState,
  ]);

  useEffect(() => {
    if (!user?.id) {
      draftHydratedUserIdRef.current = null;
      return;
    }
    if (draftHydratedUserIdRef.current === user.id) return;
    if (isWizardFreshStart(location, searchParams)) return;
    let cancelled = false;
    void (async () => {
      const draft = await loadWizardDraft(user);
      if (cancelled) return;
      draftHydratedUserIdRef.current = user.id;
      if (!draft) return;

      let linkedId = draft.linkedOrderId != null ? String(draft.linkedOrderId).trim() : "";
      if (linkedId) {
        const ok = await shouldRestoreWizardLinkedOrderId(linkedId);
        if (!ok) linkedId = "";
      }

      const next = buildInitialStateFromDraftPayload(draft);
      if (linkedId) {
        hydrateLinkedOrderIdFromDraft(linkedId);
      } else {
        clearLinkedWizardOrderId();
      }
      setActiveStep(next.activeStep);
      setCustomerInfo(next.customerInfo);
      setSelectedGarmentType(next.selectedGarmentType);
      setCustomGarmentType(next.customGarmentType);
      setReferenceImage(next.referenceImage);
      setSelectedNeck(next.selectedNeck);
      setMeasurements(next.measurements);
      setStyleOptions(next.styleOptions);
      setDesignBrief(next.designBrief);
      setData(next.data);
      setDraftVersion(next.draftVersion);
      setAssignedTailorShopId(next.assignedTailorShopId);
      setAssignedTailorDisplayName(next.assignedTailorDisplayName ?? "");
      lastPersistedSnapshotRef.current = JSON.stringify({
        activeStep: next.activeStep,
        customerInfo: next.customerInfo,
        selectedGarmentType: next.selectedGarmentType,
        customGarmentType: next.customGarmentType,
        referenceImage: next.referenceImage,
        selectedNeck: next.selectedNeck,
        measurements: next.measurements,
        styleOptions: next.styleOptions,
        designBrief: next.designBrief,
        data: next.data,
        assignedTailorShopId: next.assignedTailorShopId,
        assignedTailorDisplayName: next.assignedTailorDisplayName ?? "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, location, searchParams]);

  const prevActiveStepForMotionRef = useRef(activeStep);
  let stepTransitionDir = 1;
  const prevStepForMotion = prevActiveStepForMotionRef.current;
  if (prevStepForMotion !== activeStep) {
    stepTransitionDir = activeStep > prevStepForMotion ? 1 : -1;
    prevActiveStepForMotionRef.current = activeStep;
  }

  const resetWizardProgress = useCallback(() => {
    clearLinkedWizardOrderId();
    if (user?.id) {
      void putWizardDraft(user, null).catch(() => {});
    }
    setActiveStep(3);
    setCustomerInfo({ ...initialCustomerInfo });
    setSelectedGarmentType("");
    setCustomGarmentType("");
    setReferenceImage(null);
    setSelectedNeck("v-neck");
    setMeasurements({ ...initialMeasurements });
    setStyleOptions({ ...initialStyleOptions });
    setDesignBrief({ ...initialDesignBrief });
    setData({ ...initialWizardData });
    setDraftVersion(0);
    setAssignedTailorShopId("");
    setAssignedTailorDisplayName("");
    clearCustomerTailorShopSession();
    clearLinkedWizardOrderId();
    setBrowseTailorBanner(null);
    lastPersistedSnapshotRef.current = JSON.stringify({
      activeStep: 3,
      customerInfo: { ...initialCustomerInfo },
      selectedGarmentType: "",
      customGarmentType: "",
      referenceImage: null,
      selectedNeck: "v-neck",
      measurements: { ...initialMeasurements },
      styleOptions: { ...initialStyleOptions },
      designBrief: { ...initialDesignBrief },
      data: { ...initialWizardData },
      assignedTailorShopId: "",
      assignedTailorDisplayName: "",
    });
    setError("");
    setFieldInsight(getAdaptiveHint(3));
    setIsThinking(false);
  }, [user]);

  useEffect(() => {
    const raw = location.state;
    const bt = raw?.browseTailor;
    if (!bt || typeof bt !== "object") return;
    const locKey = location.key;
    if (browseLocationKeyHandledRef.current === locKey) return;
    browseLocationKeyHandledRef.current = locKey;

    const fresh = Boolean(raw?.startWizardFresh || raw?.fresh);

    const shopId = pickBrowseTailorShopIdFromState(bt);
    if (!shopId) {
      console.warn("[measurement wizard] browseTailor: no valid tailor shop id on state object", {
        browseKeys: Object.keys(bt),
      });
    }
    const tName = typeof bt.name === "string" ? bt.name : "Tailor";
    const tSpec = typeof bt.specialty === "string" ? bt.specialty : "";
    const tCity = typeof bt.city === "string" ? bt.city : "";
    const noteLine = `[Request via Browse — tailor: ${tName}${tSpec ? ` · ${tSpec}` : ""}${tCity ? ` · ${tCity}` : ""}]`;
    const cardDisplayName = typeof bt.name === "string" ? bt.name.trim() : "";

    if (!fresh) {
      clearLinkedWizardOrderId();
    } else {
      startWizardFresh({ user });
      clearCustomerTailorShopSession();
      setActiveStep(1);
      setCustomerInfo({ ...initialCustomerInfo });
      setSelectedGarmentType("");
      setCustomGarmentType("");
      setReferenceImage(null);
      setSelectedNeck("v-neck");
      setMeasurements({ ...initialMeasurements });
      setStyleOptions({ ...initialStyleOptions });
      setDesignBrief({ ...initialDesignBrief, designNotes: noteLine });
      setData({ ...initialWizardData });
      setDraftVersion(0);
      lastPersistedSnapshotRef.current = JSON.stringify({
        activeStep: 1,
        customerInfo: { ...initialCustomerInfo },
        selectedGarmentType: "",
        customGarmentType: "",
        referenceImage: null,
        selectedNeck: "v-neck",
        measurements: { ...initialMeasurements },
        styleOptions: { ...initialStyleOptions },
        designBrief: { ...initialDesignBrief, designNotes: noteLine },
        data: { ...initialWizardData },
        assignedTailorShopId: shopId,
        assignedTailorDisplayName: cardDisplayName,
      });
      setError("");
      setFieldInsight(getAdaptiveHint(1));
    }

    setAssignedTailorShopId(shopId);
    if (shopId) persistCustomerTailorShopSession(shopId);
    setAssignedTailorDisplayName(cardDisplayName);
    setBrowseTailorBanner({ name: tName, specialty: tSpec, city: tCity });

    if (!fresh) {
      setDesignBrief((prev) => {
        const existing = typeof prev.designNotes === "string" ? prev.designNotes : "";
        if (existing.includes(tName) && existing.includes("Request via Browse")) return prev;
        return {
          ...prev,
          designNotes: existing.trim() ? `${noteLine}\n\n${existing}` : noteLine,
        };
      });
    }

    navigate(".", { replace: true, state: null });
  }, [location.state, location.key, navigate, user]);

  useEffect(() => {
    const snapshot = JSON.stringify({
      activeStep,
      customerInfo,
      selectedGarmentType,
      customGarmentType,
      referenceImage,
      selectedNeck,
      measurements,
      styleOptions,
      designBrief,
      data,
      assignedTailorShopId,
      assignedTailorDisplayName,
    });
    if (snapshot === lastPersistedSnapshotRef.current) return;

    const id = window.setTimeout(() => {
      lastPersistedSnapshotRef.current = JSON.stringify({
        activeStep,
        customerInfo,
        selectedGarmentType,
        customGarmentType,
        referenceImage,
        selectedNeck,
        measurements,
        styleOptions,
        designBrief,
        data,
        assignedTailorShopId,
        assignedTailorDisplayName,
      });
      setDraftVersion((prev) => {
        const next = prev + 1;
        const payload = {
          activeStep,
          customerInfo,
          selectedGarmentType,
          customGarmentType,
          referenceImage,
          selectedNeck,
          measurements,
          styleOptions,
          designBrief,
          data,
          draftVersion: next,
          assignedTailorShopId,
          assignedTailorDisplayName,
          linkedOrderId: getLinkedWizardOrderId() || "",
        };
        saveWizardDraft(payload, user)
          .then(() => {
            window.dispatchEvent(new CustomEvent("sewserve:wizard-draft-updated"));
          })
          .catch(() => {});
        return next;
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [
    activeStep,
    customerInfo,
    selectedGarmentType,
    customGarmentType,
    referenceImage,
    selectedNeck,
    measurements,
    styleOptions,
    designBrief,
    data,
    assignedTailorShopId,
    assignedTailorDisplayName,
    user,
  ]);

  useEffect(() => {
    if (skipScrollOnMountRef.current) {
      skipScrollOnMountRef.current = false;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeStep]);

  useEffect(() => {
    setError("");
  }, [activeStep]);

  useEffect(() => {
    if (activeStep !== 3) {
      setAutoSaved(false);
      return;
    }
    setAutoSaved(false);
    const t = setTimeout(() => setAutoSaved(true), 2000);
    return () => clearTimeout(t);
  }, [activeStep]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void syncWizardOrderToServer(
        {
          activeStep,
          customerInfo,
          selectedGarmentType,
          customGarmentType,
          referenceImage,
          selectedNeck,
          measurements,
          styleOptions,
          designBrief,
          data,
          draftVersion,
          assignedTailorShopId,
          assignedTailorDisplayName,
        },
        user
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [
    user,
    activeStep,
    customerInfo,
    selectedGarmentType,
    customGarmentType,
    referenceImage,
    selectedNeck,
    measurements,
    styleOptions,
    designBrief,
    data,
    draftVersion,
    assignedTailorShopId,
    assignedTailorDisplayName,
  ]);

  useEffect(() => {
    setFieldInsight(getAdaptiveHint(activeStep));
  }, [activeStep]);

  useEffect(() => {
    setIsThinking(true);
    const t = setTimeout(() => setIsThinking(false), 250);
    return () => clearTimeout(t);
  }, [activeStep]);

  const handleFieldFocusInsight = useCallback(() => {
    setFieldInsight("Taking input… optimizing suggestions");
  }, []);

  const handleFieldBlurInsight = useCallback(() => {
    setFieldInsight(getAdaptiveHint(activeStep));
  }, [activeStep]);

  const updateMeasurement = (key, value) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handlePrevious = () => {
    setActiveStep((s) => Math.max(1, s - 1));
  };

  const handleSaveContinue = () => {
    if (activeStep < 6) {
      if (activeStep === 3) {
        const allFilled = BODY_MEASUREMENT_KEYS.every(
          (key) => String(measurements[key] ?? "").trim() !== ""
        );
        if (!allFilled) {
          setError("Please fill all body measurements before continuing");
          return;
        }
      }
      setError("");
      setActiveStep((s) => s + 1);
      return;
    }
    setError("");
    void (async () => {
      try {
        const customerId = resolveOrderCustomerId(user);
        if (!customerId) {
          setError("Please sign in to place an order.");
          return;
        }
        const snapshot = {
          activeStep,
          customerInfo,
          selectedGarmentType,
          customGarmentType,
          referenceImage,
          selectedNeck,
          measurements,
          styleOptions,
          designBrief,
          data,
          draftVersion,
          assignedTailorShopId: "",
          assignedTailorDisplayName: "",
        };
        const { orderId } = await createWizardDraftOrder(snapshot, user);
        if (!orderId) {
          throw new Error("Could not save your measurements. Please try again.");
        }
        if (user?.id) {
          try {
            await putCustomerMeta(user, { lastWizardOrderId: orderId });
          } catch {
            /* non-fatal */
          }
        }
        window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
        setError("");
        navigate("/location-step", {
          state: {
            fromWizard: true,
            wizardOrderId: orderId,
            returnAfterSelect: "wait_for_acceptance",
            wizardNotice: "Measurements saved. Now choose a nearby tailor.",
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not complete setup. Please try again.");
      }
    })();
  };

  const clampedStep = Math.min(6, Math.max(1, activeStep));
  const progressPct = Math.round((clampedStep / 6) * 100);
  const currentStepTitle = WIZARD_STEPS[clampedStep - 1]?.title ?? "";

  const handleReferenceImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mimeOk = /^image\/(jpeg|png)$/i.test(file.type);
    const extOk = /\.(jpe?g|png)$/i.test(file.name);
    if (!mimeOk && !extOk) return;
    if (file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setReferenceImage({ name: file.name, dataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const renderStepContent = () => {
    const stepMeta = WIZARD_STEPS[activeStep - 1];
    if (!stepMeta) return null;

    switch (stepMeta.component) {
      case "CustomerInfo":
        return (
          <>
            <div className="border-b border-white/15 pb-6 text-center sm:text-left">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{stepMeta.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Contact & order details — add what you are comfortable sharing
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6">
              <div>
                <label htmlFor="customer-name" className="text-sm font-medium text-slate-700">
                  Full Name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className={`${inputShell} mt-1.5`}>
                  <input
                    id="customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerInfo.name}
                    onChange={(e) =>
                      setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))
                    }
                    onFocus={handleFieldFocusInsight}
                    onBlur={handleFieldBlurInsight}
                    placeholder="Your name"
                    className={inputField}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="customer-phone" className="text-sm font-medium text-slate-700">
                  Phone Number <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className={`${inputShell} mt-1.5`}>
                  <input
                    id="customer-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={customerInfo.phone}
                    onChange={(e) =>
                      setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    onFocus={handleFieldFocusInsight}
                    onBlur={handleFieldBlurInsight}
                    placeholder="+92 …"
                    className={inputField}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="customer-address" className="text-sm font-medium text-slate-700">
                Address
              </label>
              <div className={`${inputShell} mt-1.5`}>
                <input
                  id="customer-address"
                  type="text"
                  autoComplete="street-address"
                  value={customerInfo.address}
                  onChange={(e) =>
                    setCustomerInfo((prev) => ({ ...prev, address: e.target.value }))
                  }
                  onFocus={handleFieldFocusInsight}
                  onBlur={handleFieldBlurInsight}
                  placeholder="Enter full delivery/pickup address"
                  className={inputField}
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-700">Order Type</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
                {[
                  { id: "pickup", label: "Pickup" },
                  { id: "delivery", label: "Delivery" },
                ].map((opt) => {
                  const selected = customerInfo.orderType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setCustomerInfo((prev) => ({ ...prev, orderType: opt.id }))
                      }
                      className={`w-full px-6 py-3 text-center text-sm font-semibold ${
                        selected ? `${MW_PRIMARY_CTA} border border-transparent` : MW_GLASS_OPTION
                      }`}
                    >
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10">
              <label htmlFor="customer-order-notes" className="text-sm font-semibold text-slate-800">
                Order Notes
              </label>
              <textarea
                id="customer-order-notes"
                rows={9}
                value={customerInfo.notes}
                onChange={(e) =>
                  setCustomerInfo((prev) => ({ ...prev, notes: e.target.value }))
                }
                onFocus={handleFieldFocusInsight}
                onBlur={handleFieldBlurInsight}
                placeholder="Tell us anything about your order (fit, urgency, design, special instructions...)"
                className="mt-2 min-h-[12rem] w-full resize-y rounded-xl border border-white/55 bg-white/55 px-3 py-3 text-sm leading-relaxed text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md transition placeholder:text-slate-400 focus:border-[#3b6b52]/50 focus:bg-white/75 focus:outline-none focus:shadow-[0_0_0_3px_rgba(31,61,43,0.14)]"
              />
            </div>
          </>
        );
      case "GarmentType":
        return (
          <>
            <div className="border-b border-white/15 pb-6 text-center sm:text-left">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{stepMeta.title}</h2>
              <p className="mt-1 text-xs text-slate-500">Choose the garment you want tailored</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {GARMENT_TYPE_OPTIONS.map((opt) => {
                const selected = selectedGarmentType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedGarmentType(opt.id)}
                    className={`flex flex-col items-start gap-2 p-4 text-left ${
                      selected ? `${MW_PRIMARY_CTA} border border-transparent` : MW_GLASS_OPTION
                    }`}
                  >
                    <span className="relative z-10 flex flex-col items-start gap-2">
                      <span className="text-3xl leading-none" aria-hidden>
                        {opt.emoji}
                      </span>
                      <span
                        className={`text-base font-semibold ${selected ? "text-white" : "text-slate-900"}`}
                      >
                        {opt.label}
                      </span>
                      <span
                        className={`text-xs font-medium leading-snug ${
                          selected ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {opt.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedGarmentType === "others" ? (
              <div className="mt-8">
                <label htmlFor="custom-garment-type" className="text-sm font-medium text-slate-700">
                  Enter custom garment type
                </label>
                <div className={`${inputShell} mt-1.5`}>
                  <input
                    id="custom-garment-type"
                    type="text"
                    value={customGarmentType}
                    onChange={(e) => setCustomGarmentType(e.target.value)}
                    onFocus={handleFieldFocusInsight}
                    onBlur={handleFieldBlurInsight}
                    placeholder="e.g. Sherwani, Abaya, Jacket…"
                    className={inputField}
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-10">
              <p className="text-sm font-semibold text-slate-800">Upload Reference Image for Tailor</p>
              <p className="mt-1 text-xs text-slate-500">JPG or PNG, max 8MB</p>
              <input
                ref={referenceFileInputRef}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                onChange={(e) => {
                  handleReferenceImageChange(e);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => referenceFileInputRef.current?.click()}
                className="group mt-4 flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/40 bg-white/30 px-4 py-10 text-center text-slate-700 backdrop-blur-md transition duration-300 hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30 focus-visible:ring-offset-2"
              >
                <Upload
                  className="h-10 w-10 text-slate-400 transition group-hover:text-[#2a5240]"
                  aria-hidden
                />
                <span className="text-sm font-medium text-slate-700">
                  {referenceImage ? "Tap to replace image" : "Drop an image here or click to browse"}
                </span>
                <span className="text-xs text-slate-500">PNG, JPG, JPEG</span>
              </button>
              {referenceImage ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/45 bg-white/35 px-4 py-3 text-sm backdrop-blur-md">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={referenceImage.name}>
                    {referenceImage.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => referenceFileInputRef.current?.click()}
                      className={`${MW_GLASS_OPTION} px-4 py-2.5 text-sm font-semibold`}
                    >
                      <span className="relative z-10">Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceImage(null)}
                      className="rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-500 transition duration-300 hover:bg-white/20 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/25 focus-visible:ring-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        );
      case "BodyMeasurements":
        return (
          <BodyMeasurementsStep
            measurements={measurements}
            updateMeasurement={updateMeasurement}
            selectedNeck={selectedNeck}
            setSelectedNeck={setSelectedNeck}
            onFieldFocus={handleFieldFocusInsight}
            onFieldBlur={handleFieldBlurInsight}
          />
        );
      case "StyleOptions":
        return <StyleOptionsStep styleOptions={styleOptions} setStyleOptions={setStyleOptions} />;
      case "DesignNotes":
        return (
          <DesignNotesStep
            designBrief={designBrief}
            setDesignBrief={setDesignBrief}
            onFieldFocus={handleFieldFocusInsight}
            onFieldBlur={handleFieldBlurInsight}
          />
        );
      case "Review":
        return (
          <ReviewStep
            customerInfo={customerInfo}
            selectedGarmentType={selectedGarmentType}
            customGarmentType={customGarmentType}
            referenceImage={referenceImage}
            measurements={measurements}
            selectedNeck={selectedNeck}
            styleOptions={styleOptions}
            designBrief={designBrief}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative isolate min-h-screen bg-transparent text-slate-600 antialiased">
      <style>
        {`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
/* Full-viewport animated wash — sits at z-0 inside isolated root; never blocks pointer events (matches SewServeLandingPage) */
.ss-page-bg-anim {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(ellipse 100% 80% at 10% 0%, rgba(167, 243, 208, 0.5), transparent 55%),
    radial-gradient(ellipse 90% 70% at 95% 15%, rgba(186, 230, 253, 0.52), transparent 52%),
    radial-gradient(ellipse 85% 60% at 50% 100%, rgba(216, 180, 254, 0.38), transparent 55%),
    radial-gradient(ellipse 60% 50% at 70% 55%, rgba(226, 232, 240, 0.45), transparent 50%),
    linear-gradient(180deg, #eef2f7 0%, #e2e8f0 35%, #f1f5f9 70%, #f8fafc 100%);
  background-size: 140% 140%;
  animation: ss-bg-gradient-drift 52s ease-in-out infinite alternate;
  filter: blur(28px) brightness(1.06);
}
/* Far depth — soft vignette for separation from mid layers */
.ss-page-bg-anim::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse 95% 90% at 50% 48%, transparent 42%, rgba(15, 23, 42, 0.065) 100%);
}
@keyframes ss-bg-gradient-drift {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 30% 100%; }
}
/* Backdrop layer — matches SewServeLandingPage ss-glass-card (soft fog, low contrast) */
.ss-glass-card {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(24px) saturate(165%);
  backdrop-filter: blur(24px) saturate(165%);
  box-shadow:
    0 2px 20px -4px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ss-glass-card:hover {
  border-color: rgba(255, 255, 255, 0.42);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.1) 100%);
}

/* Same structure as SewServeLandingPage .hero-cta — Book a Fitting CTA (dark green shadows) */
.mw-hero-cta {
  position: relative;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.32),
    inset 2px 3px 12px rgba(255, 255, 255, 0.12),
    0 6px 28px rgba(31, 61, 43, 0.38),
    0 2px 12px rgba(18, 42, 32, 0.22);
}
.mw-hero-cta::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 90% 70% at 18% 12%, rgba(255, 255, 255, 0.35) 0%, transparent 52%),
    linear-gradient(175deg, rgba(255, 255, 255, 0.1) 0%, transparent 45%);
  pointer-events: none;
}
.mw-hero-cta::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(
    105deg,
    transparent 0%,
    transparent 38%,
    rgba(255, 255, 255, 0.32) 50%,
    transparent 62%,
    transparent 100%
  );
  transform: translateX(-130%);
  transition: transform 0.75s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.mw-hero-cta:hover::after {
  transform: translateX(130%);
}

/* Landing-matched nav chrome — scopes WizardNavbar (wizard-only; landing uses SewServeLandingPage header) */
.mw-landing-nav-shell > header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.35) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 32px -8px rgba(15, 23, 42, 0.08) !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
}
.mw-landing-nav-shell > header > nav {
  padding-top: 0.875rem !important;
  padding-bottom: 0.875rem !important;
  gap: 1rem !important;
}
.mw-landing-nav-shell header nav > a[aria-label="Go to SewServe home"] {
  color: rgb(30 41 59) !important;
  font-size: 1.125rem !important;
  font-weight: 700 !important;
  letter-spacing: -0.025em !important;
}
.mw-landing-nav-shell header nav > a[aria-label="Go to SewServe home"] img {
  height: auto !important;
  max-height: 2.25rem !important;
  width: auto !important;
  max-width: min(200px, 52vw) !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  filter: none !important;
}
.mw-landing-nav-shell header nav div[class*="md:flex"] a {
  position: relative;
  color: rgb(71 85 105) !important;
  font-weight: 500 !important;
}
.mw-landing-nav-shell header nav div[class*="md:flex"] a:hover {
  color: rgb(15 23 42) !important;
}
.mw-landing-nav-shell header nav div[class*="md:flex"] a::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -6px;
  height: 2px;
  width: 0;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3b6b52, #2a5240);
  transition: width 0.28s ease;
}
.mw-landing-nav-shell header nav div[class*="md:flex"] a:hover::after,
.mw-landing-nav-shell header nav div[class*="md:flex"] a:focus-visible::after {
  width: 100%;
}
.mw-landing-nav-shell header nav div[class*="md:flex"] button[type="button"] {
  border-radius: 0.75rem !important;
  background: linear-gradient(to bottom, #2a5240, #1f3d2b) !important;
  color: white !important;
  padding: 0.625rem 1.25rem !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 6px -1px rgba(31, 61, 43, 0.3), 0 2px 4px -2px rgba(31, 61, 43, 0.22) !important;
}
.mw-landing-nav-shell header nav div[class*="md:flex"] button[type="button"]:hover {
  filter: brightness(1.05);
  box-shadow: 0 8px 16px -4px rgba(31, 61, 43, 0.4) !important;
}
.mw-landing-nav-shell header nav > button[aria-label="Toggle navigation menu"] {
  border-radius: 0.5rem !important;
  color: rgb(71 85 105) !important;
}
.mw-landing-nav-shell header nav > button[aria-label="Toggle navigation menu"]:hover {
  background: rgba(255, 255, 255, 0.15) !important;
}
.mw-landing-nav-shell > div[class*="md:hidden"] aside#navbar-mobile-slideout {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(248, 250, 252, 0.92) 100%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(170%) !important;
  backdrop-filter: blur(24px) saturate(170%) !important;
  border-left: 1px solid rgba(255, 255, 255, 0.45) !important;
  box-shadow: -8px 0 32px -8px rgba(15, 23, 42, 0.12) !important;
}
.mw-landing-nav-shell aside#navbar-mobile-slideout a:hover,
.mw-landing-nav-shell aside#navbar-mobile-slideout button:hover {
  background: rgba(255, 255, 255, 0.2) !important;
  color: rgb(31 61 43) !important;
}
.mw-landing-nav-shell aside#navbar-mobile-slideout button.bg-orange-600 {
  background: linear-gradient(to bottom, #2a5240, #1f3d2b) !important;
}
.mw-landing-nav-shell aside#navbar-mobile-slideout .text-orange-600 {
  color: rgb(42 82 64) !important;
}
`}
      </style>

      <div className="ss-page-bg-anim" aria-hidden="true" />

      {/* Same stacking + font shell as SewServeLandingPage (content above bg at z-10) */}
      <div className="relative z-10 min-h-screen font-['Inter',sans-serif]">
        <div className="mw-landing-nav-shell">
          <WizardNavbar />
        </div>

        <main className="mx-auto max-w-7xl overflow-x-hidden px-4 pb-16 pt-3 sm:px-6 sm:pt-4 lg:px-8 lg:pb-20 lg:pt-5">
          <div className="mb-5 text-center sm:mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Measurement Wizard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Step {clampedStep} of 6:{" "}
              <span className="font-medium text-slate-700">{currentStepTitle}</span>
            </p>
            <div className="mx-auto mt-4 max-w-lg px-2">
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/90 shadow-inner">
                  <motion.div
                    className="h-full max-w-full origin-left rounded-full bg-gradient-to-r from-[#4a7c59] to-[#3d5d48] shadow-[0_2px_8px_rgba(0,0,0,0.06)] will-change-[width]"
                    initial={false}
                    animate={{ width: `${progressPct}%` }}
                    transition={MW_PROGRESS_BAR_TRANSITION}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-600">{progressPct}%</span>
              </div>
            </div>
          </div>

          {browseTailorBanner ? (
            <div
              className="mx-auto mb-5 max-w-3xl rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-center text-sm text-emerald-950 shadow-sm sm:text-left"
              role="status"
            >
              <p className="font-semibold">Ordering for {browseTailorBanner.name}</p>
              {(browseTailorBanner.specialty || browseTailorBanner.city) && (
                <p className="mt-1 text-emerald-900/85">
                  {[browseTailorBanner.specialty, browseTailorBanner.city].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="mt-1 text-xs text-emerald-800/75">
                Your answers in this wizard (measurements, style, reference images, and notes) are attached to this
                request for the tailor.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6 lg:items-stretch">
            <aside className="ss-glass-card order-2 rounded-3xl p-6 lg:order-1 lg:col-span-1">
              <h2 className="border-b border-slate-200/40 pb-2 text-sm font-semibold text-slate-900">
                Wizard Progress
              </h2>
              <ol className="mt-4 space-y-1.5">
                {WIZARD_STEPS.map((step) => {
                  const n = step.id;
                  const active = activeStep === n;
                  const done = activeStep > n;
                  return (
                    <motion.li
                      key={step.component}
                      onClick={() => {
                        setActiveStep(n);
                      }}
                      initial={false}
                      whileHover={{ x: 3 }}
                      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm transition-[background-color,box-shadow,color] duration-500 ease-out ${
                        active
                          ? "bg-[rgba(74,124,89,0.08)] font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-[rgba(74,124,89,0.22)]"
                          : "font-normal text-slate-600 shadow-none ring-0"
                      }`}
                    >
                      <motion.span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          done || active
                            ? "bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] text-white"
                            : "border border-white/45 bg-white/25 text-slate-500 backdrop-blur-sm"
                        }`}
                        initial={false}
                        animate={
                          active
                            ? MW_SIDEBAR_ACTIVE_ANIMATE
                            : done
                              ? MW_SIDEBAR_INDICATOR_REST
                              : MW_SIDEBAR_INDICATOR_IDLE
                        }
                        transition={
                          active
                            ? MW_SIDEBAR_ACTIVE_PULSE_TRANSITION
                            : { duration: 0.4, ease: MW_SIDEBAR_SURFACE_EASE }
                        }
                      >
                        {done ? "✓" : n}
                      </motion.span>
                      <span className="leading-tight">{step.title}</span>
                    </motion.li>
                  );
                })}
              </ol>

              <div className="mt-6 overflow-hidden rounded-xl border border-white/30 bg-white/10 shadow-[0_1px_12px_-2px_rgba(15,23,42,0.04)] backdrop-blur-md">
                <div className="border-b border-white/20 bg-white/10 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Tip</p>
                </div>
                <p className="px-3 py-3 text-xs leading-relaxed text-slate-600">
                  Measure around the fullest part, not too tight.
                </p>
              </div>
            </aside>

            <div className="order-1 flex min-h-[70vh] flex-col justify-center lg:order-2 lg:col-span-2">
              <div className="relative mx-auto w-full max-w-[600px]">
                <div
                  className="pointer-events-none absolute -inset-x-2 -inset-y-1 z-0 rounded-[1.65rem] bg-slate-900/[0.035] backdrop-blur-md ring-1 ring-white/30 sm:-inset-x-3"
                  aria-hidden
                />
                <motion.section
                  className="ss-glass-card relative z-10 overflow-hidden rounded-3xl p-6 sm:p-7"
                  animate={{ scale: 1 }}
                  whileTap={{ scale: 0.999 }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 28%, rgba(74,124,89,0.07), transparent 58%)",
                    }}
                    aria-hidden
                  />

                  <div className="relative z-10">
                    <AnimatePresence custom={stepTransitionDir} mode="wait" initial={false}>
                      <motion.div
                        key={activeStep}
                        variants={MW_STEP_CONTENT_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        custom={stepTransitionDir}
                        transition={MW_STEP_CONTENT_TRANSITION}
                        className="relative z-10 will-change-[opacity,transform] [transform:translateZ(0)]"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="mb-4 space-y-0.5">
                          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                            Guided Measurement
                          </p>
                          <p className="text-sm leading-snug text-slate-600">
                            We'll walk you step-by-step — it only takes a minute.
                          </p>
                        </div>
                        <p className="mb-3 text-sm leading-snug text-slate-500">
                          {stepGuidance[activeStep]}
                        </p>
                        <div className="rounded-xl border border-white/35 bg-white/12 px-3.5 py-2.5 backdrop-blur-xl">
                          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                            Smart Insight
                          </p>
                          <p className="mt-1 text-sm leading-snug text-slate-600">{fieldInsight}</p>
                          {isThinking ? (
                            <p className="mt-1.5 text-xs text-slate-400 animate-pulse">
                              Updating suggestions…
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-6 space-y-6">{renderStepContent()}</div>
                      </motion.div>
                    </AnimatePresence>

                    {error ? (
                      <p className="mt-5 text-center text-sm text-red-600 sm:text-left" role="alert">
                        {error}
                      </p>
                    ) : null}

                    <div className="mt-8 flex flex-col gap-5 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className={`${MW_SECONDARY} sm:min-w-[8.5rem]`}
                  >
                    <span className="relative z-10 inline-flex items-center gap-2">
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                      Previous
                    </span>
                  </button>

                  <div className="flex items-center justify-center gap-3 sm:flex-1">
                    <span
                      className={`h-px flex-1 max-w-[4rem] bg-gradient-to-r from-transparent to-slate-400/35 sm:max-w-[5rem] ${
                        activeStep !== 3 ? "opacity-0" : ""
                      }`}
                      aria-hidden={activeStep !== 3}
                    />
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        activeStep === 3
                          ? autoSaved
                            ? "text-slate-700"
                            : "text-slate-400"
                          : "invisible"
                      }`}
                    >
                      {activeStep === 3 ? (autoSaved ? "Auto-saved" : "Saving…") : "Auto-saved"}
                    </p>
                    <span
                      className={`h-px flex-1 max-w-[4rem] bg-gradient-to-l from-transparent to-slate-400/35 sm:max-w-[5rem] ${
                        activeStep !== 3 ? "opacity-0" : ""
                      }`}
                      aria-hidden={activeStep !== 3}
                    />
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleSaveContinue}
                    className={`${MW_PRIMARY_CTA} inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base`}
                    whileTap={{ scale: 1.012 }}
                    transition={{ type: "tween", duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="relative z-10 inline-flex items-center gap-2">
                      {activeStep === 6 ? (
                        <>
                          Complete Setup
                          <Check className="h-4 w-4" aria-hidden />
                        </>
                      ) : (
                        <>
                          Continue
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </>
                      )}
                    </span>
                  </motion.button>
                    </div>
                  </div>
                </motion.section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
