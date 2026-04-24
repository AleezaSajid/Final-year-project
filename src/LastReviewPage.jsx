import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardNavbar from "./components/DashboardNavbar";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import { normalizeStatus } from "./tailorDashboard/constants";
import {
  TD_GLASS_CARD,
  TD_GLASS_CARD_COMPACT,
  TD_INPUT_CLASS,
  TD_PRIMARY_BUTTON_CLASS,
} from "./tailorDashboard/tailorDashboardClassNames";

const API_BASE_URL = "http://localhost:5000";
const CURRENT_TAILOR_ID = "T-A1";

const statusLabel = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "needs_alteration") return "Needs Alteration";
  if (value === "last_review") return "Last Review";
  if (value === "ready_for_delivery") return "Ready for Delivery";
  if (value === "quality_check") return "Quality Check";
  if (value === "stitching") return "Stitching";
  if (value === "measurements_verified") return "Measurements Verified";
  if (value === "completed") return "Completed";
  return "Pending";
};

function parseMaybeObject(value) {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Wizard / API `notes` may be a string or { occasion, urgency, specialInstructions, designNote, ... }. */
function WizardCustomerNotes({ notes }) {
  if (notes == null) {
    return <p className="text-slate-500">Not provided</p>;
  }
  if (typeof notes === "string") {
    const t = notes.trim();
    return t ? (
      <p className="whitespace-pre-wrap text-slate-700">{notes}</p>
    ) : (
      <p className="text-slate-500">Not provided</p>
    );
  }
  if (typeof notes !== "object" || Array.isArray(notes)) {
    return <p className="text-slate-500">Not provided</p>;
  }
  const n = notes;
  const rows = [
    ["Occasion", n.occasion],
    ["Urgency", n.urgency],
    ["Special Instructions", n.specialInstructions],
    ["Design Note", n.designNote],
    ["Preferred delivery", n.deliveryDate],
  ].filter(([, v]) => v != null && String(v).trim() !== "");

  if (rows.length === 0) {
    return <p className="text-slate-500">Not provided</p>;
  }

  return (
    <div className="space-y-2 text-sm text-slate-700">
      {rows.map(([label, value]) => (
        <p key={label}>
          <span className="font-medium text-ink">{label}:</span> {String(value)}
        </p>
      ))}
    </div>
  );
}

function primitiveEntries(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).filter(
    ([k, v]) =>
      v != null &&
      (typeof v === "string" || typeof v === "number" || typeof v === "boolean") &&
      String(v).trim() !== "" &&
      k !== "images"
  );
}

function StyleAndMeasurementsSummary({ measurements, style }) {
  const m = measurements && typeof measurements === "object" && !Array.isArray(measurements) ? measurements : {};
  const s = style && typeof style === "object" && !Array.isArray(style) ? style : {};
  const mRows = primitiveEntries(m);
  const sRows = primitiveEntries(s);
  const labelize = (k) =>
    String(k)
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^\s+/, "")
      .replace(/^./, (c) => c.toUpperCase());

  if (mRows.length === 0 && sRows.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-white/40 pt-3 text-sm">
      {sRows.length > 0 ? (
        <div>
          <p className="font-medium text-ink">Style</p>
          <ul className="mt-1 space-y-1 text-slate-700">
            {sRows.map(([k, v]) => (
              <li key={k}>
                <span className="font-medium text-slate-800">{labelize(k)}:</span> {String(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {mRows.length > 0 ? (
        <div>
          <p className="font-medium text-ink">Measurements</p>
          <ul className="mt-1 space-y-1 text-slate-700">
            {mRows.map(([k, v]) => (
              <li key={k}>
                <span className="font-medium text-slate-800">{labelize(k)}:</span> {String(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function LastReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const incomingOrder = location.state?.order || null;
  const [order, setOrder] = useState(incomingOrder);
  const [tailorOrdersSnapshot, setTailorOrdersSnapshot] = useState([]);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);

  const [rating, setRating] = useState(0);
  const [reviewStatus, setReviewStatus] = useState("Passed");
  const [internalNotes, setInternalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeOrder = useMemo(
    () =>
      order || {
        id: orderId,
        customerId: "N/A",
        customerName: "Customer",
        garmentType: "Garment",
        status: "",
        orderImages: [],
        measurements: {},
        notes: "",
        dueDate: "",
      },
    [order, orderId]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchOrder = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/tailor/${CURRENT_TAILOR_ID}`);
        if (!response.ok) return;
        const payload = await response.json();
        if (!isMounted || !Array.isArray(payload)) return;
        setTailorOrdersSnapshot(payload);
        const found = payload.find(
          (item) => String(item._id || item.id) === String(orderId)
        );
        if (found) {
          setOrder({
            ...found,
            id: found._id || found.id,
          });
        } else {
          navigate("/tailor/dashboard");
        }
      } catch {
        navigate("/tailor/dashboard");
      } finally {
        if (isMounted) setIsLoadingOrder(false);
      }
    };

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [navigate, orderId]);

  useEffect(() => {
    if (isLoadingOrder) return;
    if (String(safeOrder.status || "").toLowerCase() !== "last_review") {
      navigate("/tailor/dashboard");
    }
  }, [isLoadingOrder, navigate, safeOrder.status]);

  useEffect(() => {
    if (!order) return;
    setRating(Number(safeOrder.review?.rating) || 0);
    setReviewStatus(safeOrder.review?.reviewStatus || "Passed");
    setInternalNotes(safeOrder.review?.notes || "");
  }, [order, safeOrder.review]);

  const images = Array.isArray(safeOrder.orderImages)
    ? safeOrder.orderImages
    : Array.isArray(safeOrder.measurements?.images)
      ? safeOrder.measurements.images
      : [];

  const orderPayloadParsed = useMemo(() => parseMaybeObject(safeOrder.orderPayload), [safeOrder.orderPayload]);

  const mergedMeasurements = useMemo(() => {
    const fromP = orderPayloadParsed?.measurements;
    const fromO = safeOrder.measurements;
    const a = fromP && typeof fromP === "object" && !Array.isArray(fromP) ? fromP : {};
    const b = fromO && typeof fromO === "object" && !Array.isArray(fromO) ? fromO : {};
    return { ...a, ...b };
  }, [orderPayloadParsed, safeOrder.measurements]);

  const mergedStyle = useMemo(() => {
    const fromP = orderPayloadParsed?.style;
    const fromO = safeOrder.style;
    const a = fromP && typeof fromP === "object" && !Array.isArray(fromP) ? fromP : {};
    const b = fromO && typeof fromO === "object" && !Array.isArray(fromO) ? fromO : {};
    return { ...b, ...a };
  }, [orderPayloadParsed, safeOrder.style]);

  const wizardCustomerNotes = useMemo(() => {
    const nOrder = safeOrder.notes;
    if (nOrder != null) {
      if (typeof nOrder === "string" && nOrder.trim()) return nOrder;
      if (typeof nOrder === "object" && !Array.isArray(nOrder)) return nOrder;
    }
    const nPayload = orderPayloadParsed?.notes;
    if (nPayload != null) {
      if (typeof nPayload === "string" && nPayload.trim()) return nPayload;
      if (typeof nPayload === "object" && !Array.isArray(nPayload)) return nPayload;
    }
    return null;
  }, [safeOrder.notes, orderPayloadParsed]);

  const upcomingOrdersPreview = useMemo(() => {
    if (!Array.isArray(tailorOrdersSnapshot) || tailorOrdersSnapshot.length === 0) return [];
    const currentId = String(safeOrder.id || orderId || "");
    return tailorOrdersSnapshot
      .map((item) => ({
        ...item,
        id: String(item._id || item.id),
      }))
      .filter((o) => o.id !== currentId)
      .filter((o) => normalizeStatus(o.status) !== "completed")
      .sort((a, b) => {
        const ta = new Date(a.dueDate || a.date || 0).getTime();
        const tb = new Date(b.dueDate || b.date || 0).getTime();
        const aOk = Number.isFinite(ta);
        const bOk = Number.isFinite(tb);
        if (!aOk && !bOk) return 0;
        if (!aOk) return 1;
        if (!bOk) return -1;
        return ta - tb;
      })
      .slice(0, 4);
  }, [tailorOrdersSnapshot, safeOrder.id, orderId]);

  const updateStatusAndReturn = async (nextStatus) => {
    if (!safeOrder?.id) return;
    setIsSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/orders/${safeOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          review: {
            rating,
            reviewStatus,
            notes: internalNotes,
            reviewedBy: "tailor",
            reviewedAt: new Date().toISOString(),
          },
        }),
      });
    } catch {
      // Keep UX resilient and return to dashboard even if request fails.
    } finally {
      setIsSubmitting(false);
      navigate("/tailor/dashboard");
    }
  };

  const glassCard = TD_GLASS_CARD;
  const upcomingCard = `${TD_GLASS_CARD_COMPACT} max-w-xl`;

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
      <LandingStylePageBackground />
      <DashboardNavbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl space-y-6 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/tailor/dashboard")}
          className="mb-1 text-sm font-medium text-emerald-800/90 transition hover:text-emerald-700 hover:underline"
        >
          ← Back to Dashboard
        </button>
        <section className={glassCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dashboard / Orders / Last Review</p>
          <h1 className="text-apple-h3 mt-1 font-semibold text-ink">Final inspection</h1>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p>
              <span className="font-medium text-slate-800">Order ID:</span>{" "}
              <span className="text-slate-700">{safeOrder.id || "N/A"}</span>
            </p>
            <p>
              <span className="font-medium text-slate-800">Customer:</span>{" "}
              <span className="text-slate-700">{safeOrder.customerName || safeOrder.customerId || "N/A"}</span>
            </p>
            <p>
              <span className="font-medium text-slate-800">Garment:</span>{" "}
              <span className="text-slate-700">{safeOrder.garmentType || "N/A"}</span>
            </p>
            <p>
              <span className="font-medium text-slate-800">Status:</span>{" "}
              <span className="text-slate-700">{statusLabel(safeOrder.status)}</span>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => navigate(`/chat/${safeOrder.customerId || "customer"}`)}
              className="text-emerald-800/90 transition hover:text-emerald-700 hover:underline"
            >
              Open Chat
            </button>
            <button
              type="button"
              onClick={() => navigate("/tailor/dashboard")}
              className="text-emerald-800/90 transition hover:text-emerald-700 hover:underline"
            >
              View All Orders
            </button>
          </div>
        </section>

        <section className={upcomingCard} aria-label="Upcoming orders">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" strokeWidth={2} aria-hidden />
            <h2 className="text-sm font-semibold text-ink">Upcoming orders</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Other active orders by due date (excludes this inspection)</p>
          {isLoadingOrder ? (
            <p className="mt-3 text-xs text-slate-500">Loading schedule…</p>
          ) : upcomingOrdersPreview.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No other active orders on file.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcomingOrdersPreview.map((o) => {
                const due = o.dueDate || o.date;
                const dueLabel =
                  due != null && String(due).trim() !== ""
                    ? (() => {
                        const d = new Date(due);
                        return Number.isFinite(d.getTime())
                          ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : String(due).slice(0, 10);
                      })()
                    : "—";
                return (
                  <li
                    key={o.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/45 bg-white/40 px-3 py-2 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{o.customerName || "Customer"}</p>
                      <p className="truncate text-slate-600">{o.garmentType || "Garment"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{statusLabel(o.status)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Due</p>
                      <p className="font-medium text-slate-700">{dueLabel}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className={glassCard}>
            <h2 className="text-lg font-semibold text-ink">Garment preview</h2>
            <div className="mt-3">
              {images.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {images.map((img, index) => {
                    const label =
                      typeof img === "string"
                        ? img
                        : img && typeof img === "object"
                          ? String(img.url || img.src || img.path || "Image")
                          : String(img ?? "");
                    return (
                      <div
                        key={`${label}-${index}`}
                        className="rounded-xl border border-white/50 bg-white/50 p-3 text-xs text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/60 bg-white/40 p-6 text-center text-sm text-slate-500 backdrop-blur-sm">
                  No preview available
                </div>
              )}
            </div>
          </div>

          <div className={glassCard}>
            <h2 className="text-lg font-semibold text-ink">Customer notes & details</h2>
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Wizard notes</p>
              <div className="mt-2">
                <WizardCustomerNotes notes={wizardCustomerNotes} />
              </div>
              <StyleAndMeasurementsSummary measurements={mergedMeasurements} style={mergedStyle} />
            </div>
          </div>
        </section>

        <section className={glassCard}>
          <h2 className="text-lg font-semibold text-ink">Final quality review</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Quality rating</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`text-2xl transition ${
                      value <= rating ? "text-emerald-600 drop-shadow-sm" : "text-slate-300"
                    }`}
                    aria-label={`Set rating ${value}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="review-status">
                Review status
              </label>
              <select
                id="review-status"
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value)}
                className={`${TD_INPUT_CLASS} mt-2`}
              >
                <option>Passed</option>
                <option>Needs Alteration</option>
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="text-sm font-medium text-slate-800" htmlFor="internal-notes">
                Internal notes
              </label>
              <textarea
                id="internal-notes"
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Add final inspection notes..."
                className={`${TD_INPUT_CLASS} mt-2 h-24 resize-y`}
              />
            </div>
          </div>
        </section>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-white/40 bg-white/70 shadow-[0_-8px_32px_rgba(31,38,135,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => updateStatusAndReturn("needs_alteration")}
            className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50/80 disabled:opacity-60"
          >
            Request Alteration
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => updateStatusAndReturn("completed")}
            className={`${TD_PRIMARY_BUTTON_CLASS} disabled:opacity-60`}
          >
            Confirm delivery
          </button>
        </div>
      </div>
    </div>
  );
}
