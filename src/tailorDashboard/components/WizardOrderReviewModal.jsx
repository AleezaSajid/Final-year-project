import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Ruler, Scissors, User, X } from "lucide-react";
import { buildViewModelFromFullWizardData } from "../../utils/wizardDataToReviewViewModel.js";

/** Matches `ChatWindow` panel glass (gradient + blur). */
const CHAT_GLASS_PANEL_STYLE = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 100%)",
  WebkitBackdropFilter: "blur(28px) saturate(180%)",
  backdropFilter: "blur(28px) saturate(180%)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 8px 32px -10px rgba(15, 23, 42, 0.15)",
};

function DetailRow({ label, value }) {
  if (value == null || String(value).trim() === "") return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/30 py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
      <span className="min-w-0 text-sm text-slate-900">{String(value)}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-white/40 bg-white/40 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-white/25 backdrop-blur-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
        {Icon ? <Icon className="h-4 w-4 text-emerald-700" strokeWidth={2} aria-hidden /> : null}
        {title}
      </h3>
      <div className="space-y-0">{children}</div>
    </section>
  );
}

function humanizeKey(key) {
  if (typeof key !== "string" || !key) return "";
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).trim();
}

function formatWizardDeliveryDate(notesDelivery, orderDue) {
  let raw = "";
  if (notesDelivery != null && String(notesDelivery).trim() !== "") {
    raw = String(notesDelivery).trim();
  } else if (orderDue != null) {
    const s = String(orderDue);
    raw = s.length >= 10 ? s.slice(0, 10) : s;
  }
  if (!raw) return "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  const day = m ? m[1] : raw;
  try {
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

const MEASUREMENT_LABELS = {
  chest: "Chest",
  shoulder: "Shoulder",
  waist: "Waist",
  neck: "Neck",
  armLength: "Arm length",
  sleeveLength: "Sleeve length",
};

/**
 * Resolves wizard-shaped fields from API order (prefers nested orderPayload snapshot).
 */
function resolveWizardView(order) {
  if (order?.wizardData && typeof order.wizardData === "object" && !Array.isArray(order.wizardData)) {
    return buildViewModelFromFullWizardData(order.wizardData, order);
  }
  const op = order?.orderPayload;
  if (op && typeof op === "object" && !Array.isArray(op) && ("activeStep" in op || "customerInfo" in op)) {
    return buildViewModelFromFullWizardData(op, order);
  }
  let rawPayload = order?.orderPayload;
  if (typeof rawPayload === "string" && rawPayload.trim()) {
    try {
      rawPayload = JSON.parse(rawPayload);
    } catch {
      rawPayload = null;
    }
  }
  const p = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload : null;
  const customerName = p?.customer?.name ?? order?.customerName ?? "—";
  const customerPhone = p?.customer?.phone ?? order?.customerPhone ?? "";
  const customerId = p?.customer?.id ?? order?.customerId ?? "";
  const garmentType = p?.garment?.type ?? order?.garmentType ?? "—";
  const garmentCategory = p?.garment?.category ?? order?.garmentCategory ?? "";
  const measurements = {
    ...(p?.measurements && typeof p.measurements === "object" ? p.measurements : {}),
    ...(order?.measurements && typeof order.measurements === "object" ? order.measurements : {}),
  };
  const style = {
    ...(order?.style && typeof order.style === "object" ? order.style : {}),
    ...(p?.style && typeof p.style === "object" ? p.style : {}),
  };
  const notes = {
    ...(order?.notes && typeof order.notes === "object" ? order.notes : {}),
    ...(p?.notes && typeof p.notes === "object" ? p.notes : {}),
  };
  const wizardOrderId = p?.orderId ?? order?.clientOrderId ?? "";
  const createdAt = p?.createdAt ?? order?.createdAt ?? "";
  const designImage = p?.image || p?.referenceImage?.dataUrl || null;
  return {
    customerName,
    customerPhone,
    customerId,
    garmentType,
    garmentCategory,
    measurements,
    style,
    notes,
    image: designImage,
    wizardOrderId,
    createdAt,
    hasPayload: Boolean(p),
  };
}

export default function WizardOrderReviewModal({ order, open, onClose, updateOrderStatus }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const view = order ? resolveWizardView(order) : null;

  useEffect(() => {
    if (!open) return;
    console.log("view.image:", view?.image);
  }, [open, view?.image]);

  const measurementKeys =
    view && view.measurements && typeof view.measurements === "object"
      ? Object.keys(view.measurements)
      : [];
  const measurementEntries = view
    ? measurementKeys
        .map((key) => {
          const v = view.measurements[key];
          if (v == null || String(v).trim() === "") return null;
          const label = MEASUREMENT_LABELS[key] || humanizeKey(key);
          return <DetailRow key={key} label={`${label} (in)`} value={v} />;
        })
        .filter(Boolean)
    : [];

  const STYLE_DETAIL_KEYS = ["fitType", "fabricType", "stylePreference", "neckStyle"];
  const extraStyleEntries =
    view && view.style && typeof view.style === "object"
      ? Object.entries(view.style).filter(
          ([k, v]) =>
            !STYLE_DETAIL_KEYS.includes(k) &&
            v != null &&
            String(v).trim() !== "" &&
            typeof v !== "object"
        )
      : [];

  const NOTES_DETAIL_KEYS = ["deliveryDate", "occasion", "urgency", "specialInstructions", "designNote"];
  const extraNotesEntries =
    view && view.notes && typeof view.notes === "object"
      ? Object.entries(view.notes).filter(
          ([k, v]) =>
            !NOTES_DETAIL_KEYS.includes(k) &&
            v != null &&
            String(v).trim() !== "" &&
            typeof v !== "object"
        )
      : [];

  const overlay =
    open && view && order ? (
      <motion.div
        key="wizard-review-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-review-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/35 px-4 py-6 backdrop-blur-[3px] sm:items-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex max-h-[min(90vh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/40 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.2)] ring-1 ring-white/30"
          style={CHAT_GLASS_PANEL_STYLE}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/35 bg-gradient-to-r from-emerald-50/50 via-white/20 to-sky-50/30 px-5 py-4">
            <div className="min-w-0">
              <p id="wizard-review-title" className="text-lg font-semibold tracking-tight text-slate-900">
                Customer request — measurements &amp; design
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-600">{view.customerName}</p>
              <p className="truncate text-xs text-slate-500">{view.garmentType}</p>
              <p className="mt-3 rounded-lg border border-emerald-200/70 bg-emerald-50/90 px-3 py-2 text-xs leading-relaxed text-emerald-950">
                <span className="font-semibold">Action needed:</span> This is a new request from your customer.
                Review everything below, then use <span className="font-semibold">Accept request</span> to take the
                order on and mark measurements as verified.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/50 bg-white/45 p-2.5 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/60 to-white/30 px-5 py-4">
            <div className="space-y-4">
              <Section icon={User} title="Customer & order">
                <DetailRow label="Name" value={view.customerName} />
                <DetailRow label="Phone" value={view.customerPhone} />
                <DetailRow label="Customer ID" value={view.customerId} />
                <DetailRow label="Order ref" value={view.wizardOrderId || order?.id} />
                <DetailRow label="Submitted" value={view.createdAt ? new Date(view.createdAt).toLocaleString() : ""} />
                {!view.hasPayload ? (
                  <p className="rounded-lg border border-amber-200/60 bg-amber-50/50 py-2 px-2 text-xs text-amber-900/90 backdrop-blur-sm">
                    Full wizard snapshot was not stored; showing saved order fields only.
                  </p>
                ) : null}
              </Section>

              <Section icon={Scissors} title="Garment">
                <DetailRow label="Garment" value={view.garmentType} />
                <DetailRow label="Category" value={view.garmentCategory} />
              </Section>

              <Section icon={Ruler} title="Measurements (in)">
                {measurementEntries.length > 0 ? (
                  measurementEntries
                ) : (
                  <p className="py-2 text-sm text-slate-500">No numeric measurements on file.</p>
                )}
              </Section>

              <Section title="Style">
                <DetailRow label="Fit" value={view.style.fitType} />
                <DetailRow label="Fabric" value={view.style.fabricType} />
                <DetailRow label="Style preference" value={view.style.stylePreference} />
                <DetailRow label="Neck" value={view.style.neckStyle} />
                {extraStyleEntries.map(([k, v]) => (
                  <DetailRow key={k} label={humanizeKey(k)} value={v} />
                ))}
              </Section>

              <Section title="Notes & design">
                {view.image && (
                  <div className="border-b border-white/30 py-2 last:border-0">
                    <img
                      src={view.image}
                      alt="Uploaded design"
                      className="w-full h-auto rounded-lg object-cover"
                    />
                  </div>
                )}
                <DetailRow
                  label="Preferred delivery"
                  value={formatWizardDeliveryDate(view.notes.deliveryDate, order?.dueDate)}
                />
                <DetailRow label="Occasion" value={view.notes.occasion} />
                <DetailRow label="Urgency" value={view.notes.urgency} />
                <DetailRow label="Special instructions" value={view.notes.specialInstructions} />
                {extraNotesEntries.map(([k, v]) => (
                  <DetailRow key={k} label={humanizeKey(k)} value={v} />
                ))}
                {view.notes.designNote ? (
                  <div className="border-b border-white/30 py-2 last:border-0">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Design notes</span>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{view.notes.designNote}</p>
                  </div>
                ) : null}
              </Section>

              {view.fromFullWizardData && view.fullWizardMeta ? (
                <Section title="Order & session (wizard)">
                  <DetailRow label="Active step" value={view.fullWizardMeta.activeStep} />
                  <DetailRow label="Draft version" value={view.fullWizardMeta.draftVersion} />
                  <DetailRow label="Order type" value={view.fullWizardMeta.orderType} />
                  <DetailRow label="Address" value={view.fullWizardMeta.address} />
                  <DetailRow label="Customer order notes" value={view.fullWizardMeta.customerOrderNotes} />
                  <DetailRow
                    label="Reference image"
                    value={
                      view.fullWizardMeta.hasReferenceImage
                        ? view.fullWizardMeta.referenceImageName
                          ? `Yes — ${view.fullWizardMeta.referenceImageName}`
                          : "Yes"
                        : ""
                    }
                  />
                  {view.fullWizardMeta.extraData != null && view.fullWizardMeta.extraData !== "" ? (
                    <div className="border-b border-white/30 py-2 last:border-0">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Extra data</span>
                      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
                        {typeof view.fullWizardMeta.extraData === "object"
                          ? JSON.stringify(view.fullWizardMeta.extraData, null, 2)
                          : String(view.fullWizardMeta.extraData)}
                      </p>
                    </div>
                  ) : null}
                </Section>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-white/35 bg-white/25 px-5 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-end">
            <p className="order-2 text-center text-[11px] text-slate-500 sm:order-1 sm:mr-auto sm:max-w-[55%] sm:text-left">
              <span className="font-medium text-slate-600">Not ready?</span> Close and come back from{" "}
              <span className="font-medium text-slate-700">Measurements to Review</span> anytime.
            </p>
            <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/50 bg-white/45 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (order?.id) {
                    await updateOrderStatus(order.id, "measurements_verified");
                  }
                  onClose();
                }}
                className="rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 active:scale-[0.98]"
              >
                Accept request
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    ) : null;

  if (typeof document === "undefined") return null;

  return createPortal(<AnimatePresence mode="wait">{overlay}</AnimatePresence>, document.body);
}
