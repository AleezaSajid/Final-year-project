import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Package,
  Scissors,
  ChevronDown,
  ExternalLink,
  LifeBuoy,
  Mail,
  AlertTriangle,
  ListOrdered,
  X,
} from "lucide-react";

import { notifyChatIdsFromOrderUpdated, publishChatRoomCustomerId } from "./chatUtils.js";
import { listOrdersForCustomer, mapOrdersToRecentRows } from "./api/ordersApi.js";
import { mapApiOrderToRecentRow } from "./utils/mapApiOrderToRecentRow.js";
import { socket } from "./socket.js";
import DashboardNavbar from "./components/DashboardNavbar.jsx";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { resolveCustomerIdForChat, TAILOR_SESSION_STORAGE_KEY } from "./utils/chatIdentity.js";
import {
  MEASUREMENT_WIZARD_STORAGE_KEY,
  buildDashboardProfileRows,
  buildDashboardProfileRowsFromOrder,
  readWizardStateFromStorage,
} from "./utils/wizardDashboardProfile.js";

const PUB = process.env.PUBLIC_URL || "";
const SUPPORT_EMAIL = "info@sewserve.com";

const SUPPORT_FAQ = [
  {
    id: "update-measurements",
    question: "How to update measurements?",
    answer:
      "Open the Measurement Wizard from “Update Measurements” on this dashboard, enter your latest numbers, and save. Your profile and new orders will use the updated measurements.",
  },
  {
    id: "change-order",
    question: "Can I change my order?",
    answer:
      "Contact us as soon as possible with your order ID. Changes depend on whether tailoring has started—we’ll confirm what’s possible and help you update details or timing.",
  },
  {
    id: "stitching-time",
    question: "How long does stitching take?",
    answer:
      "Typical turnaround depends on garment complexity and urgency you selected. You’ll see status updates in Recent Orders; use Track Order anytime to jump back to that list.",
  },
  {
    id: "contact-tailor",
    question: "How to contact tailor?",
    answer:
      "Use Contact Support to email our team, or Report Issue with your order selected so we can route your message with the right context.",
  },
];

const WEDDING_CLASSIC_INSPIRATION = {
  title: "Wedding Classic",
  description: "Timeless silhouettes and soft, celebratory detail.",
  src: `${PUB}/images/hero/mannequin.png`,
};

/** Design tokens — match dashboard mockup */
const C = {
  heading: "#1a1a1a",
  green: "#4c7c4c",
  greenDark: "#3d6b4a",
  yellow: "#e1a92a",
  redBrown: "#c25441",
};

const EMPTY_PROFILE_ROWS = { measurement: [], styleOptions: [], notes: [] };

function isPlainOrderObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Merge partial socket/API payloads without dropping nested order fields. */
function mergeOrderPatch(existing, patch) {
  if (!isPlainOrderObject(patch)) return existing;
  const base = isPlainOrderObject(existing) ? existing : {};
  const out = { ...base, ...patch };
  for (const key of ["notes", "orderPayload", "wizardData", "measurements", "style"]) {
    const p = patch[key];
    const e = base[key];
    if (isPlainOrderObject(p) && isPlainOrderObject(e)) {
      out[key] = { ...e, ...p };
    } else if (p !== undefined) {
      out[key] = p;
    }
  }
  return out;
}

function sortOrdersByNewestFirst(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(a.createdAt || a.date || 0).getTime();
    const tb = new Date(b.createdAt || b.date || 0).getTime();
    return tb - ta;
  });
}

/**
 * Pull garment + style labels from latest API order (or nested orderPayload).
 * @param {Record<string, unknown> | null | undefined} order
 */
function extractStyleContextFromOrder(order) {
  if (!order || typeof order !== "object") {
    return { garmentType: "formal outfit", fitType: "", stylePreference: "" };
  }
  const garmentType =
    (typeof order.garmentType === "string" && order.garmentType.trim()) ||
    (order.orderPayload &&
      order.orderPayload.garment &&
      typeof order.orderPayload.garment.type === "string" &&
      order.orderPayload.garment.type.trim()) ||
    "formal outfit";
  const styleObj =
    order.style && typeof order.style === "object" && !Array.isArray(order.style)
      ? order.style
      : order.orderPayload && typeof order.orderPayload.style === "object"
        ? order.orderPayload.style
        : null;
  const fitType = styleObj?.fitType != null ? String(styleObj.fitType).trim() : "";
  const stylePreference =
    styleObj?.stylePreference != null ? String(styleObj.stylePreference).trim() : "";
  return { garmentType, fitType, stylePreference };
}

function buildPinterestStyleSearchUrl(order) {
  const { garmentType, fitType, stylePreference } = extractStyleContextFromOrder(order);
  const query = `${garmentType} ${fitType} ${stylePreference} outfit`.replace(/\s+/g, " ").trim();
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
}

function StyleInspirationCard({ latestOrder }) {
  const openPinterest = () => {
    const url = buildPinterestStyleSearchUrl(latestOrder ?? null);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="overflow-hidden rounded-apple-card border border-gray-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6"
      style={{ boxShadow: "0 4px 20px -6px rgba(15, 23, 42, 0.08)" }}
    >
      <header>
        <h3 className="text-[15px] font-bold leading-tight tracking-tight" style={{ color: C.heading }}>
          Style Guide &amp; Tips
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">Get inspired for your next outfit</p>
      </header>

      <article className="mx-auto mt-5 max-w-md overflow-hidden rounded-xl border border-slate-200/75 bg-gradient-to-b from-white to-slate-50/60 shadow-sm shadow-slate-900/[0.04]">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <img
            src={WEDDING_CLASSIC_INSPIRATION.src}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.opacity = "0.35";
            }}
          />
        </div>
        <div className="flex flex-col p-3 pt-2.5 sm:p-4 sm:pt-3">
          <h4 className="text-[13px] font-semibold leading-snug text-slate-900">{WEDDING_CLASSIC_INSPIRATION.title}</h4>
          {WEDDING_CLASSIC_INSPIRATION.description ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{WEDDING_CLASSIC_INSPIRATION.description}</p>
          ) : null}
        </div>
      </article>

      <button
        type="button"
        onClick={openPinterest}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/15 bg-gradient-to-b from-white to-emerald-50/40 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-800/25 hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
      >
        Explore More Styles
        <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="sr-only">Opens Pinterest in a new tab</span>
      </button>
    </div>
  );
}

function StatusPill({ variant }) {
  if (variant === "processing") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(76, 124, 76, 0.12)", color: C.greenDark }}
      >
        Processing
      </span>
    );
  }
  if (variant === "delivered") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(76, 124, 76, 0.15)", color: C.greenDark }}
      >
        Delivered
      </span>
    );
  }
  if (variant === "alteration") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(234, 88, 12, 0.14)", color: "#9a3412" }}
      >
        Alteration
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: "rgba(225, 169, 42, 0.2)", color: "#92400e" }}
    >
      Out for Delivery
    </span>
  );
}

/** Three-column status cards — icon row, copy row, tinted footer + pill (mock layout) */
function StatusSummaryCard({
  icon: Icon,
  iconBgClass,
  iconClass,
  title,
  titleClassName,
  description,
  badgeLabel,
  badgeStyle,
  footerTintClass,
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-apple-card border border-gray-200/90 bg-white"
      style={{ boxShadow: "0 4px 24px -6px rgba(15, 23, 42, 0.1)" }}
    >
      <div className="flex flex-col items-center bg-white px-4 pt-7 pb-2">
        <div className={`flex h-[52px] w-[52px] items-center justify-center rounded-full ${iconBgClass}`}>
          <Icon className={`h-7 w-7 ${iconClass}`} strokeWidth={2} aria-hidden />
        </div>
      </div>
      <div className="px-4 pb-4 text-center">
        <h3
          className={`text-[15px] font-bold leading-snug font-serif ${titleClassName}`}
          style={{ color: titleClassName ? undefined : C.heading }}
        >
          {title}
        </h3>
        <p className="mt-2.5 text-[13px] leading-[1.6] text-ink-muted">{description}</p>
      </div>
      <div className={`flex justify-center px-4 py-4 ${footerTintClass}`}>
        <span
          className="rounded-full px-4 py-1.5 text-xs font-semibold text-white"
          style={badgeStyle}
        >
          {badgeLabel}
        </span>
      </div>
    </div>
  );
}

function formatProfileValue(value, unit) {
  if (value == null || value === "") return "—";
  return unit ? `${value} ${unit}` : String(value);
}

function ProfileRows({ rows }) {
  return (
    <dl className="divide-y divide-slate-100/90">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-1">
          <dt className="shrink-0 text-[13px] font-medium tracking-wide text-slate-500">{row.label}</dt>
          <dd
            className="min-w-0 flex-1 text-right text-[13px] font-semibold leading-snug break-words text-slate-800"
            style={{ color: C.heading }}
          >
            {formatProfileValue(row.value, row.unit)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Profile rows from the selected API order when available; wizard draft only after load confirms zero orders.
 */
function MeasurementProfileAccordion({ profileFromOrder, ordersLoading, ordersLength }) {
  const allowWizardFallback = !ordersLoading && ordersLength === 0;
  const [openId, setOpenId] = useState(/** @type {"measurement" | "styleOptions" | "notes" | null} */ ("measurement"));
  const [wizardProfile, setWizardProfile] = useState(() => buildDashboardProfileRows(readWizardStateFromStorage()));

  useEffect(() => {
    if (profileFromOrder != null || !allowWizardFallback) return undefined;
    const sync = () => setWizardProfile(buildDashboardProfileRows(readWizardStateFromStorage()));
    const onStorage = (e) => {
      if (e.key === MEASUREMENT_WIZARD_STORAGE_KEY || e.key === null) sync();
    };
    sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
    };
  }, [profileFromOrder, allowWizardFallback]);

  const profile = profileFromOrder ?? (allowWizardFallback ? wizardProfile : EMPTY_PROFILE_ROWS);

  const toggle = (id) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const sections = [
    {
      id: "measurement",
      title: "Measurement",
      rows: profile?.measurement ?? [],
    },
    {
      id: "styleOptions",
      title: "Style Options",
      rows: profile?.styleOptions ?? [],
    },
    {
      id: "notes",
      title: "Notes",
      rows: profile?.notes ?? [],
    },
  ];

  return (
    <div className="flex w-full flex-col gap-2.5">
      {sections.map(({ id, title, rows }) => {
        const isOpen = openId === id;
        return (
          <div
            key={id}
            className="overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/40 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
          >
            <button
              type="button"
              id={`measure-accordion-${id}`}
              aria-expanded={isOpen}
              aria-controls={`measure-panel-${id}`}
              onClick={() => toggle(id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-1"
            >
              <span className="text-[15px] font-bold tracking-tight text-slate-900">{title}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2}
                aria-hidden
              />
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id={`measure-panel-${id}`}
                  role="region"
                  aria-labelledby={`measure-accordion-${id}`}
                  className="border-t border-slate-100/90 px-4 pb-4 pt-0.5"
                >
                  <ProfileRows rows={rows} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function orderIdentity(order) {
  if (!order || typeof order !== "object") return "";
  const raw = order._id ?? order.id ?? order.orderId;
  if (raw != null && typeof raw === "object" && "$oid" in raw && raw.$oid != null) {
    return String(raw.$oid).trim();
  }
  return String(raw ?? "").trim();
}

function upsertCustomerOrderList(prev, raw, customerId) {
  if (!raw || typeof raw !== "object") return prev;
  const cid = String(customerId || "").trim();
  const orderCid = String(raw.customerId || "").trim();
  if (!cid || orderCid !== cid) return prev;
  const id = orderIdentity(raw);
  if (!id) return prev;
  const i = prev.findIndex((o) => orderIdentity(o) === id);
  let next;
  if (i === -1) {
    next = [raw, ...prev];
  } else {
    const merged = mergeOrderPatch(prev[i], raw);
    next = [...prev];
    next[i] = merged;
  }
  return sortOrdersByNewestFirst(next);
}

/** Garment label for “Showing details for…” (API + nested payload + table fallback). */
function profileContextGarmentLabel(order) {
  if (!order || typeof order !== "object") return "Latest Order";
  const fromGarment =
    order.garment && typeof order.garment === "object" && typeof order.garment.type === "string"
      ? order.garment.type.trim()
      : "";
  const fromPayloadGarment =
    order.orderPayload?.garment &&
    typeof order.orderPayload.garment === "object" &&
    typeof order.orderPayload.garment.type === "string"
      ? String(order.orderPayload.garment.type).trim()
      : "";
  const fromGarmentType = typeof order.garmentType === "string" ? order.garmentType.trim() : "";
  const combined = fromGarment || fromPayloadGarment || fromGarmentType;
  if (combined) return combined;
  const item = mapApiOrderToRecentRow(order).item;
  return item && item !== "—" ? item : "Latest Order";
}

function formatRawOrderStatus(order) {
  if (!order || typeof order !== "object") return "—";
  const s = order.status;
  if (s == null || String(s).trim() === "") return "—";
  const t = String(s).replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Order-aware Help & Support card with quick actions, modals, and FAQ.
 */
function HelpSupportCard({ orders, onTrackOrder }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [faqOpenId, setFaqOpenId] = useState(/** @type {string | null} */ (null));
  const [reportOrderKey, setReportOrderKey] = useState("");
  const [reportText, setReportText] = useState("");

  const latestOrder = orders[0] ?? null;
  const latestRow = latestOrder ? mapApiOrderToRecentRow(latestOrder) : null;

  useEffect(() => {
    if (!contactOpen && !reportOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setContactOpen(false);
        setReportOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactOpen, reportOpen]);

  const openReportModal = () => {
    const key = orderIdentity(latestOrder) || orderIdentity(orders[0]) || "";
    setReportOrderKey(key);
    setReportText("");
    setReportOpen(true);
  };

  const submitReport = () => {
    const order = orders.find((o) => orderIdentity(o) === reportOrderKey) || orders[0];
    if (!order) return;
    const row = mapApiOrderToRecentRow(order);
    const subject = `SewServe: Issue report — ${row.orderId}`;
    const body = `Order ID: ${row.orderId}\nItem: ${row.item}\nStatus: ${formatRawOrderStatus(order)}\n\n${reportText.trim() || "(no details provided)"}`;
    setReportOpen(false);
    setReportText("");
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const openContactMailtoFromModal = () => {
    const subject =
      latestOrder != null
        ? `SewServe support — ${latestRow?.orderId ?? "Order"}`
        : "SewServe support question";
    const body =
      latestOrder != null
        ? `Hi SewServe team,\n\nI need help with my order.\n\nOrder: ${latestRow?.orderId ?? "—"}\nItem: ${latestRow?.item ?? "—"}\n\n`
        : "Hi SewServe team,\n\n";
    setContactOpen(false);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const toggleFaq = (id) => {
    setFaqOpenId((cur) => (cur === id ? null : id));
  };

  const hasOrders = orders.length > 0;

  return (
    <>
      <div
        className="flex h-full flex-col overflow-hidden rounded-apple-card border border-gray-200/90 bg-white/95 p-5 text-left shadow-sm backdrop-blur-sm sm:p-6"
        style={{ boxShadow: "0 4px 20px -6px rgba(15, 23, 42, 0.08)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <LifeBuoy className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <header className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-tight tracking-tight" style={{ color: C.heading }}>
              Help &amp; Support
            </h3>
            <p className="mt-1 text-[12px] leading-snug text-slate-500">Need help with your order?</p>
          </header>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 px-3.5 py-3 shadow-sm shadow-slate-900/[0.03]">
          {latestOrder && latestRow ? (
            <dl className="space-y-2 text-[12px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-medium text-slate-500">Garment</dt>
                <dd className="text-right font-semibold text-slate-800">{latestRow.item}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="font-medium text-slate-500">Order status</dt>
                <dd className="flex flex-wrap items-center justify-end gap-2">
                  <StatusPill variant={latestRow.variant} />
                  <span className="text-[11px] text-slate-400">({formatRawOrderStatus(latestOrder)})</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-[12px] leading-relaxed text-slate-600">
              No recent orders yet. Need help getting started?
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-emerald-800/20 hover:bg-emerald-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            Contact Support
          </button>
          <button
            type="button"
            disabled={!hasOrders}
            onClick={openReportModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-amber-800/20 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600/90" aria-hidden />
            Report Issue
          </button>
          <button
            type="button"
            onClick={onTrackOrder}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-sky-300/80 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2"
          >
            <ListOrdered className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
            Track Order
          </button>
        </div>

        <div className="mt-4 border-t border-slate-100/90 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">FAQ</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {SUPPORT_FAQ.map(({ id, question, answer }) => {
              const open = faqOpenId === id;
              return (
                <div
                  key={id}
                  className="overflow-hidden rounded-lg border border-slate-200/70 bg-white/80 shadow-sm shadow-slate-900/[0.02]"
                >
                  <button
                    type="button"
                    id={`faq-trigger-${id}`}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${id}`}
                    onClick={() => toggleFaq(id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-slate-800 transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-inset"
                  >
                    <span className="min-w-0">{question}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                    style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div
                        id={`faq-panel-${id}`}
                        role="region"
                        aria-labelledby={`faq-trigger-${id}`}
                        className="border-t border-slate-100/90 px-3 pb-2.5 pt-1 text-[11px] leading-relaxed text-slate-600"
                      >
                        {answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {contactOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="presentation"
          onClick={() => setContactOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-contact-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="support-contact-title" className="text-base font-bold text-slate-900">
                Contact Support
              </h4>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Email our team at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-emerald-800 underline-offset-2 hover:underline">
                {SUPPORT_EMAIL}
              </a>
              . We&apos;ll include your latest order context when you use the button below.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={openContactMailtoFromModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2"
                style={{ backgroundColor: C.green }}
              >
                <Mail className="h-4 w-4" aria-hidden />
                Open in email app
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="presentation"
          onClick={() => setReportOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-report-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="support-report-title" className="text-base font-bold text-slate-900">
                Report an issue
              </h4>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label htmlFor="report-order" className="mt-4 block text-xs font-semibold text-slate-600">
              Order
            </label>
            <select
              id="report-order"
              value={reportOrderKey}
              onChange={(e) => setReportOrderKey(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-600/25"
            >
              {orders.map((o) => {
                const id = orderIdentity(o);
                const r = mapApiOrderToRecentRow(o);
                return (
                  <option key={id || r.orderId} value={id}>
                    {r.orderId} — {r.item}
                  </option>
                );
              })}
            </select>
            <label htmlFor="report-details" className="mt-4 block text-xs font-semibold text-slate-600">
              Describe the issue
            </label>
            <textarea
              id="report-details"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={4}
              placeholder="What went wrong? Include any relevant details."
              className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-600/25"
            />
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2"
                style={{ backgroundColor: C.green }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  /** Selected order for details (workflow/profile); empty string = default to latest in list. */
  const [activeOrderId, setActiveOrderId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const recentRows = useMemo(() => mapOrdersToRecentRows(orders), [orders]);

  const activeOrder = useMemo(() => {
    if (!orders.length) return null;
    if (activeOrderId) {
      const found = orders.find((o) => orderIdentity(o) === activeOrderId);
      if (found) return found;
    }
    return orders[0] ?? null;
  }, [orders, activeOrderId]);

  const profileFromOrder = useMemo(() => {
    if (!activeOrder) return null;
    return buildDashboardProfileRowsFromOrder(activeOrder);
  }, [activeOrder]);

  const scrollToRecentOrders = useCallback(() => {
    const first = orders[0];
    setActiveOrderId(first ? orderIdentity(first) : "");
    window.requestAnimationFrame(() => {
      document.getElementById("customer-dashboard-recent-orders")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      document.getElementById("customer-dashboard-recent-orders")?.focus({ preventScroll: true });
    });
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const cid = resolveCustomerIdForChat(user);
      const list = await listOrdersForCustomer(cid);
      const sorted = sortOrdersByNewestFirst(list);
      setOrders(sorted);
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : "Could not load orders.");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const cid = String(resolveCustomerIdForChat(user) || "").trim();
    if (!cid) return undefined;

    const onOrderNew = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      if (String(raw.customerId || "").trim() !== cid) return;
      console.log("[Customer Sync] order:new", raw.id ?? raw._id ?? "");
      setOrders((prev) => upsertCustomerOrderList(prev, raw, cid));
    };

    const onMeasurementUpdated = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      if (String(raw.customerId || "").trim() !== cid) return;
      console.log("[Customer Sync] measurement:updated", raw.id ?? raw._id ?? "");
      setOrders((prev) => upsertCustomerOrderList(prev, raw, cid));
    };

    const onOrderStatusUpdated = (data) => {
      if (!data) return;
      if (data.fullOrder && typeof data.fullOrder === "object") {
        const raw = data.fullOrder;
        if (String(raw.customerId || "").trim() !== cid) return;
        console.log("[Customer Sync] order:statusUpdated fullOrder", raw.id ?? raw._id ?? "");
        setOrders((prev) => upsertCustomerOrderList(prev, raw, cid));
        return;
      }
      if (data.orderId == null || data.status == null) return;
      const oid = String(data.orderId);
      const st = String(data.status);
      console.log("[Customer Sync] order:statusUpdated patch", oid, st);
      setOrders((prev) =>
        prev.map((o) => (orderIdentity(o) === oid ? mergeOrderPatch(o, { status: st }) : o))
      );
    };

    socket.on("order:new", onOrderNew);
    socket.on("measurement:updated", onMeasurementUpdated);
    socket.on("order:statusUpdated", onOrderStatusUpdated);

    return () => {
      socket.off("order:new", onOrderNew);
      socket.off("measurement:updated", onMeasurementUpdated);
      socket.off("order:statusUpdated", onOrderStatusUpdated);
    };
  }, [user]);

  useEffect(() => {
    if (!activeOrderId) return;
    const stillHere = orders.some((o) => orderIdentity(o) === activeOrderId);
    if (!stillHere) setActiveOrderId("");
  }, [orders, activeOrderId]);

  useEffect(() => {
    const cid = resolveCustomerIdForChat(user);
    const active = activeOrder;
    const roomCustomer =
      active && active.customerId != null && String(active.customerId).trim() !== ""
        ? String(active.customerId).trim()
        : cid;
    publishChatRoomCustomerId(roomCustomer);
    try {
      const tid =
        active && active.tailorId != null && String(active.tailorId).trim() !== ""
          ? String(active.tailorId).trim()
          : null;
      if (tid && /^T-/i.test(tid)) {
        localStorage.setItem(TAILOR_SESSION_STORAGE_KEY, tid);
      }
    } catch {
      /* ignore */
    }
    notifyChatIdsFromOrderUpdated();
  }, [activeOrder, orders, user]);

  useEffect(() => {
    const onRefresh = () => void fetchOrders();
    window.addEventListener("sewserve:orders-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("sewserve:orders-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [fetchOrders]);

  return (
    <div
      id="home"
      className="relative isolate min-h-screen overflow-x-hidden antialiased"
      style={{ backgroundColor: "#eceff3" }}
    >
      <LandingStylePageBackground />

      <DashboardNavbar />

      <div className="relative z-10 font-['Inter',system-ui,sans-serif] text-slate-600">
        <main className="w-full">
          <div className="mx-auto max-w-7xl px-4 py-[72px] sm:px-6 lg:px-8 lg:py-20">
            {/* Status cards — tinted footers per mock */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:gap-6">
              <StatusSummaryCard
                icon={Truck}
                iconBgClass="bg-sky-100"
                iconClass="text-sky-600"
                title="Out for Delivery"
                titleClassName=""
                description="Your order is on the way."
                badgeLabel="In Transit"
                badgeStyle={{ backgroundColor: C.green }}
                footerTintClass="bg-emerald-50/90"
              />
              <StatusSummaryCard
                icon={Package}
                iconBgClass="bg-amber-100"
                iconClass="text-amber-600"
                title="Delivered"
                titleClassName="!text-[#d4a017]"
                description="Your order has been delivered."
                badgeLabel="Completed"
                badgeStyle={{ backgroundColor: C.green }}
                footerTintClass="bg-amber-50/80"
              />
              <StatusSummaryCard
                icon={Scissors}
                iconBgClass="bg-slate-200"
                iconClass="text-[#1e3a5f]"
                title="Alteration"
                titleClassName="!text-[#1e3a5f]"
                description="Your garment is being adjusted or refitted to your measurements."
                badgeLabel="Alteration"
                badgeStyle={{ backgroundColor: C.green }}
                footerTintClass="bg-slate-100/80"
              />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              {/* Recent Orders — exact mock table */}
              <section
                id="customer-dashboard-recent-orders"
                tabIndex={-1}
                className="scroll-mt-24 rounded-apple-card border border-gray-200/90 bg-white p-5 shadow-sm outline-none ring-emerald-600/0 transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-emerald-600/30 sm:p-6 lg:col-span-7"
                style={{ boxShadow: "0 4px 24px -6px rgba(15, 23, 42, 0.08)" }}
              >
                <h2 className="text-apple-h3 font-semibold" style={{ color: C.heading }}>
                  Recent Orders
                </h2>
                {ordersError ? (
                  <p className="mt-3 text-sm text-amber-800/90" role="alert">
                    {ordersError}
                  </p>
                ) : null}
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Order ID</th>
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Item</th>
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Date created</th>
                        <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            Loading orders…
                          </td>
                        </tr>
                      ) : recentRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            No orders yet. Complete the measurement wizard to create your first order.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => {
                          const row = mapApiOrderToRecentRow(order);
                          return (
                            <tr key={row.rawId || row.orderId || orderIdentity(order)} className="border-b border-gray-100 last:border-0">
                              <td className="py-3.5 pr-4 font-medium" style={{ color: C.heading }}>
                                {row.orderId}
                              </td>
                              <td className="py-3.5 pr-4 text-slate-700">{row.item}</td>
                              <td className="py-3.5 pr-4">
                                <StatusPill variant={row.variant} />
                              </td>
                              <td className="py-3.5 pr-4 text-slate-600">{row.delivery}</td>
                              <td className="py-3.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveOrderId(orderIdentity(order))}
                                  className="text-sm font-medium text-emerald-700 underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-1"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/orders")}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:ring-offset-2"
                >
                  View All Orders
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
              </section>

              {/* Right column */}
              <div className="flex flex-col gap-5 lg:col-span-5">
                <section
                  className="w-full rounded-apple-card border-2 border-sky-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6"
                  style={{ boxShadow: "0 4px 24px -6px rgba(15, 23, 42, 0.08)" }}
                  aria-label="Design and measurement profile"
                >
                  <h2 className="text-apple-h3 font-semibold tracking-tight" style={{ color: C.heading }}>
                    Your Design &amp; Measurement Profile
                  </h2>

                  <p className="mb-2 mt-2 text-xs text-gray-500">
                    Viewing:{" "}
                    {activeOrder
                      ? (typeof activeOrder.garmentType === "string" && activeOrder.garmentType.trim()
                          ? activeOrder.garmentType
                          : profileContextGarmentLabel(activeOrder))
                      : "No order selected"}
                  </p>

                  <div className="mt-5">
                    <MeasurementProfileAccordion
                      key={profileFromOrder ? orderIdentity(activeOrder) || "order" : "wizard"}
                      profileFromOrder={profileFromOrder}
                      ordersLoading={ordersLoading}
                      ordersLength={orders.length}
                    />
                  </div>

                  <div className="mt-6 flex justify-end border-t border-slate-100/90 pt-5">
                    <button
                      type="button"
                      onClick={() => navigate("/features/measurement-wizard")}
                      className="rounded-apple px-[18px] py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-out hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2"
                      style={{ backgroundColor: C.green }}
                    >
                      Update Measurements
                    </button>
                  </div>
                </section>

                {/* Side-by-side small cards — mock layout */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StyleInspirationCard latestOrder={activeOrder} />

                  <HelpSupportCard orders={orders} onTrackOrder={scrollToRecentOrders} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
