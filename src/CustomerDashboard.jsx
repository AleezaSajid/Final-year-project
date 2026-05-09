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
  CircleHelp,
  X,
} from "lucide-react";

import {
  isOrderEligibleForChat,
  notifyChatIdsFromOrderUpdated,
  publishChatRoomCustomerId,
} from "./chatUtils.js";
import { listOrdersForCustomer, mapOrdersToRecentRows } from "./api/ordersApi.js";
import { mapApiOrderToRecentRow } from "./utils/mapApiOrderToRecentRow.js";
import { socket } from "./socket.js";
import DashboardNavbar from "./components/DashboardNavbar.jsx";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useCustomerChat } from "./context/CustomerChatContext.jsx";
import { resolveCustomerIdForChat, TAILOR_SESSION_STORAGE_KEY } from "./utils/chatIdentity.js";
import {
  buildDashboardProfileRows,
  buildDashboardProfileRowsFromOrder,
} from "./utils/wizardDashboardProfile.js";
import { loadWizardDraft } from "./api/wizardDraftApi.js";

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

/** Glass panel — matches marketing nav glass feel */
const GLASS_CARD =
  "overflow-hidden rounded-2xl border border-white/40 bg-white/45 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14)] backdrop-blur-xl";

function StyleInspirationCard({ latestOrder }) {
  const openPinterest = () => {
    const url = buildPinterestStyleSearchUrl(latestOrder ?? null);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`flex h-full min-h-0 flex-col p-3 sm:p-4 ${GLASS_CARD}`}>
      <header className="shrink-0">
        <h3 className="text-sm font-bold leading-tight tracking-tight" style={{ color: C.heading }}>
          Style Guide &amp; Tips
        </h3>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">Get inspired for your next outfit</p>
      </header>

      <article className="mx-auto mt-2.5 w-full max-w-md shrink-0 overflow-hidden rounded-lg border border-slate-200/75 bg-gradient-to-b from-white to-slate-50/60 shadow-sm shadow-slate-900/[0.04]">
        <div className="relative h-24 w-full overflow-hidden bg-slate-100 sm:h-28">
          <img
            src={WEDDING_CLASSIC_INSPIRATION.src}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.opacity = "0.35";
            }}
          />
        </div>
        <div className="flex flex-col px-2.5 py-2 sm:px-3">
          <h4 className="text-xs font-semibold leading-snug text-slate-900">{WEDDING_CLASSIC_INSPIRATION.title}</h4>
          {WEDDING_CLASSIC_INSPIRATION.description ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">{WEDDING_CLASSIC_INSPIRATION.description}</p>
          ) : null}
        </div>
      </article>

      <button
        type="button"
        onClick={openPinterest}
        className="mt-auto flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-800/15 bg-gradient-to-b from-white to-emerald-50/40 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-800/25 hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
      >
        Explore More Styles
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
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

/** Three-column status cards — icon row, copy row, tinted footer + pill */
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
    <div className={`flex flex-col ${GLASS_CARD}`}>
      <div className="flex flex-col items-center bg-white/30 px-4 pt-7 pb-2">
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
        <div key={row.label} className="flex items-start justify-between gap-3 py-1.5 first:pt-0">
          <dt className="shrink-0 text-[11px] font-medium tracking-wide text-slate-500">{row.label}</dt>
          <dd
            className="min-w-0 flex-1 text-right text-[11px] font-semibold leading-snug break-words text-slate-800"
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
  const { user } = useAuth();
  const allowWizardFallback = !ordersLoading && ordersLength === 0;
  const [openId, setOpenId] = useState(/** @type {"measurement" | "styleOptions" | "notes" | null} */ (null));
  const [wizardProfile, setWizardProfile] = useState(() => buildDashboardProfileRows(null));

  useEffect(() => {
    if (profileFromOrder != null || !allowWizardFallback) return undefined;
    let cancelled = false;
    const sync = async () => {
      if (!user?.id) {
        if (!cancelled) setWizardProfile(buildDashboardProfileRows(null));
        return;
      }
      const draft = await loadWizardDraft(user);
      if (cancelled) return;
      setWizardProfile(buildDashboardProfileRows(draft));
    };
    void sync();
    const onDraft = () => {
      void sync();
    };
    window.addEventListener("sewserve:wizard-draft-updated", onDraft);
    window.addEventListener("focus", onDraft);
    return () => {
      cancelled = true;
      window.removeEventListener("sewserve:wizard-draft-updated", onDraft);
      window.removeEventListener("focus", onDraft);
    };
  }, [profileFromOrder, allowWizardFallback, user?.id, user?.email]);

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
    <div className="flex w-full flex-col gap-1.5">
      {sections.map(({ id, title, rows }) => {
        const isOpen = openId === id;
        return (
          <div
            key={id}
            className="overflow-hidden rounded-lg border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/40 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
          >
            <button
              type="button"
              id={`measure-accordion-${id}`}
              aria-expanded={isOpen}
              aria-controls={`measure-panel-${id}`}
              onClick={() => toggle(id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-1"
            >
              <span className="text-sm font-semibold tracking-tight text-slate-900">{title}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
                  className="border-t border-slate-100/90 px-3 pb-2 pt-0"
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
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [reportOrderKey, setReportOrderKey] = useState("");
  const [reportText, setReportText] = useState("");

  const latestOrder = orders[0] ?? null;
  const latestRow = latestOrder ? mapApiOrderToRecentRow(latestOrder) : null;

  useEffect(() => {
    if (!contactOpen && !reportOpen && !faqModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setContactOpen(false);
        setReportOpen(false);
        setFaqModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactOpen, reportOpen, faqModalOpen]);

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

  const hasOrders = orders.length > 0;

  return (
    <>
      <div className={`flex h-full min-h-0 flex-col p-3 text-left sm:p-4 ${GLASS_CARD}`}>
        <div className="flex shrink-0 items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100/90 text-sky-700">
            <LifeBuoy className="h-4 w-4" strokeWidth={2} aria-hidden />
          </div>
          <header className="min-w-0 flex-1">
            <h3 className="text-sm font-bold leading-tight tracking-tight" style={{ color: C.heading }}>
              Help &amp; Support
            </h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Need help with your order?</p>
          </header>
        </div>

        <div className="mt-2 shrink-0 rounded-lg border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 px-2.5 py-2 shadow-sm shadow-slate-900/[0.03]">
          {latestOrder && latestRow ? (
            <dl className="space-y-1 text-[11px]">
              <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                <dt className="font-medium text-slate-500">Garment</dt>
                <dd className="text-right font-semibold text-slate-800">{latestRow.item}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <dt className="font-medium text-slate-500">Order status</dt>
                <dd className="flex flex-wrap items-center justify-end gap-1.5">
                  <StatusPill variant={latestRow.variant} />
                  <span className="text-[10px] text-slate-400">({formatRawOrderStatus(latestOrder)})</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-[11px] leading-snug text-slate-600">
              No recent orders yet. Need help getting started?
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-emerald-800/20 hover:bg-emerald-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
          >
            <Mail className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            Contact Support
          </button>
          <button
            type="button"
            disabled={!hasOrders}
            onClick={openReportModal}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-amber-800/20 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600/90" aria-hidden />
            Report Issue
          </button>
          <button
            type="button"
            onClick={onTrackOrder}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-sky-300/80 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2"
          >
            <ListOrdered className="h-3 w-3 shrink-0 text-sky-600" aria-hidden />
            Track Order
          </button>
          <button
            type="button"
            onClick={() => setFaqModalOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 px-2.5 py-2 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
          >
            <CircleHelp className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            Common questions
          </button>
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

      {faqModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="presentation"
          onClick={() => setFaqModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-faq-title"
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h4 id="support-faq-title" className="text-base font-bold text-slate-900">
                Common questions
              </h4>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {SUPPORT_FAQ.map(({ id, question, answer }) => (
                  <li key={id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold text-slate-900">{question}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{answer}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CustomerDashboardChatCard({ activeOrder }) {
  const { openCustomerChat, unreadChatCount, lastChatPreview } = useCustomerChat();

  const eligible = activeOrder && isOrderEligibleForChat(activeOrder);
  if (!eligible) return null;

  const unreadLabel = unreadChatCount > 99 ? "99+" : String(unreadChatCount);

  const previewText = lastChatPreview?.text?.trim()
    ? lastChatPreview.text
    : "No messages yet — open chat to reach your tailor.";

  return (
    <button
      type="button"
      onClick={() => openCustomerChat()}
      className={`group flex min-h-0 w-full min-w-0 flex-1 flex-col p-5 text-left outline-none transition duration-300 ease-out hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 sm:p-6 ${GLASS_CARD}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <h2 className="text-apple-h3 font-semibold tracking-tight text-slate-900">
            <span className="mr-1.5" aria-hidden>
              💬
            </span>
            Chat
          </h2>
          <p className="mt-1 text-sm font-medium text-emerald-900/80">Message your tailor</p>
        </div>
        {unreadChatCount > 0 ? (
          <span
            className="flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold tabular-nums text-white shadow-md ring-2 ring-white/90"
            aria-label={`${unreadLabel} unread messages`}
          >
            {unreadLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <p className="text-sm leading-relaxed text-slate-700">
          Your tailor is available for chat regarding this order.
        </p>
        {previewText ? (
          <p className="mt-2 line-clamp-1 text-sm leading-snug text-slate-600">{previewText}</p>
        ) : null}
      </div>

      <span className="mt-auto inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-800/25 bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition duration-300 group-hover:brightness-105">
        Open Chat
      </span>
    </button>
  );
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { syncCustomerOrderChatFromOrder } = useCustomerChat();
  const [orders, setOrders] = useState([]);
  /** Selected order for details (workflow/profile); empty string = default to latest in list. */
  const [activeOrderId, setActiveOrderId] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const recentRows = useMemo(() => mapOrdersToRecentRows(orders), [orders]);

  const statusCounts = useMemo(() => {
    const counts = { inTransit: 0, delivered: 0, alteration: 0 };
    for (const o of orders) {
      const v = mapApiOrderToRecentRow(o).variant;
      if (v === "inTransit") counts.inTransit += 1;
      else if (v === "delivered") counts.delivered += 1;
      else if (v === "alteration") counts.alteration += 1;
    }
    return counts;
  }, [orders]);

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
    syncCustomerOrderChatFromOrder(activeOrder ?? null);
  }, [activeOrder, syncCustomerOrderChatFromOrder]);

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
            {/* Row 1 — three status cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:gap-6">
              <StatusSummaryCard
                icon={Truck}
                iconBgClass="bg-sky-100"
                iconClass="text-sky-600"
                title="Out for Delivery"
                titleClassName=""
                description={
                  ordersLoading
                    ? "Loading your orders…"
                    : statusCounts.inTransit > 0
                      ? `${statusCounts.inTransit} order${statusCounts.inTransit === 1 ? "" : "s"} in transit.`
                      : "No orders currently in transit."
                }
                badgeLabel={
                  ordersLoading
                    ? "—"
                    : `${statusCounts.inTransit} In Transit`
                }
                badgeStyle={{ backgroundColor: C.green }}
                footerTintClass="bg-emerald-50/90"
              />
              <StatusSummaryCard
                icon={Package}
                iconBgClass="bg-amber-100"
                iconClass="text-amber-600"
                title="Delivered"
                titleClassName="!text-[#d4a017]"
                description={
                  ordersLoading
                    ? "Loading your orders…"
                    : statusCounts.delivered > 0
                      ? `${statusCounts.delivered} delivered order${statusCounts.delivered === 1 ? "" : "s"}.`
                      : "No delivered orders yet."
                }
                badgeLabel={
                  ordersLoading
                    ? "—"
                    : `${statusCounts.delivered} Completed`
                }
                badgeStyle={{ backgroundColor: C.green }}
                footerTintClass="bg-amber-50/80"
              />
              <StatusSummaryCard
                icon={Scissors}
                iconBgClass="bg-slate-200"
                iconClass="text-[#1e3a5f]"
                title="Alteration"
                titleClassName="!text-[#1e3a5f]"
                description={
                  ordersLoading
                    ? "Loading your orders…"
                    : statusCounts.alteration > 0
                      ? `${statusCounts.alteration} order${statusCounts.alteration === 1 ? "" : "s"} needs alteration.`
                      : "No orders flagged for alteration."
                }
                badgeLabel={
                  ordersLoading
                    ? "—"
                    : `${statusCounts.alteration} Alteration`
                }
                badgeStyle={{ backgroundColor: C.green }}
                footerTintClass="bg-slate-100/80"
              />
            </div>

            {/* Row 2 — Recent Orders + Chat (stack on mobile, side-by-side from lg; equal height) */}
            <div className="mt-8 grid grid-cols-1 gap-5 lg:mt-10 lg:grid-cols-12 lg:items-stretch lg:gap-6">
              <section
                id="customer-dashboard-recent-orders"
                tabIndex={-1}
                className={`scroll-mt-24 flex min-h-0 w-full flex-col p-5 outline-none ring-emerald-600/0 transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-emerald-600/30 sm:p-6 lg:col-span-8 ${GLASS_CARD}`}
              >
                <style>
                  {`
                    .recent-orders-scroll {
                      scrollbar-width: thin;
                      scrollbar-color: rgba(61, 107, 74, 0.45) transparent;
                    }
                    .recent-orders-scroll::-webkit-scrollbar {
                      width: 8px;
                    }
                    .recent-orders-scroll::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    .recent-orders-scroll::-webkit-scrollbar-thumb {
                      background-color: rgba(61, 107, 74, 0.4);
                      border-radius: 9999px;
                      border: 2px solid transparent;
                      background-clip: padding-box;
                    }
                    .recent-orders-scroll::-webkit-scrollbar-thumb:hover {
                      background-color: rgba(61, 107, 74, 0.55);
                    }
                  `}
                </style>
                <h2 className="shrink-0 text-apple-h3 font-semibold" style={{ color: C.heading }}>
                  Recent Orders
                </h2>
                {ordersError ? (
                  <p className="mt-3 shrink-0 text-sm text-amber-800/90" role="alert">
                    {ordersError}
                  </p>
                ) : null}
                <div
                  className="recent-orders-scroll relative mt-4 max-h-[160px] overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth rounded-xl border border-slate-200/50 bg-white/35 py-2 pl-3 pr-2 sm:mt-5 sm:py-3 sm:pl-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[5] after:h-7 after:bg-gradient-to-t after:from-white/90 after:from-40% after:to-transparent"
                  aria-label="Recent orders list, scroll for more"
                >
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-gray-200/90 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-sm">
                      <tr>
                        <th className="w-[19%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                          Order ID
                        </th>
                        <th className="w-[26%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                          Item
                        </th>
                        <th className="w-[22%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                          Status
                        </th>
                        <th className="w-[18%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                          Date
                        </th>
                        <th className="w-[15%] pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/90">
                      {ordersLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            Loading orders…
                          </td>
                        </tr>
                      ) : recentRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-1 py-8 text-center text-sm leading-relaxed text-slate-500">
                            No orders yet. Complete the measurement wizard to create your first order.
                          </td>
                        </tr>
                      ) : (
                        orders.slice(0, 10).map((order) => {
                          const row = mapApiOrderToRecentRow(order);
                          return (
                            <tr key={row.rawId || row.orderId || orderIdentity(order)} className="align-top">
                              <td
                                className="py-3 pr-2 font-medium sm:py-3.5 sm:pr-3"
                                style={{ color: C.heading }}
                                title={row.orderId}
                              >
                                <span className="line-clamp-2 break-all sm:line-clamp-1">{row.orderId}</span>
                              </td>
                              <td className="py-3 pr-2 text-slate-700 sm:py-3.5 sm:pr-3" title={row.item}>
                                <span className="line-clamp-2 break-words">{row.item}</span>
                              </td>
                              <td className="py-3 pr-2 sm:py-3.5 sm:pr-3">
                                <StatusPill variant={row.variant} />
                              </td>
                              <td
                                className="py-3 pr-2 text-slate-600 sm:py-3.5 sm:pr-3"
                                title={row.delivery}
                              >
                                <span className="line-clamp-2 break-words sm:line-clamp-1">{row.delivery}</span>
                              </td>
                              <td className="py-3 sm:py-3.5">
                                <div className="flex flex-col items-start gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setActiveOrderId(orderIdentity(order))}
                                    className="text-left text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-1"
                                  >
                                    View Details
                                  </button>
                                  {row.variant === "delivered" ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/customer/review/${encodeURIComponent(orderIdentity(order))}`)}
                                      className="text-left text-sm font-medium text-blue-700 underline decoration-blue-700/30 underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:ring-offset-1"
                                    >
                                      Leave Review
                                    </button>
                                  ) : null}
                                </div>
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
                  className="mt-5 inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:ring-offset-2"
                >
                  View All Orders
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
              </section>

              <div className="flex h-full min-h-0 w-full min-w-0 flex-col lg:col-span-4">
                <CustomerDashboardChatCard activeOrder={activeOrder} />
              </div>
            </div>

            {/* Row 3 — equal-height cards (grid stretch + h-full flex columns) */}
            <div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3 lg:mt-10">
              <section
                className={`flex h-full min-h-0 flex-col p-3 sm:p-4 ${GLASS_CARD}`}
                aria-label="Design and measurement profile"
              >
                <h2 className="shrink-0 text-base font-semibold tracking-tight sm:text-lg" style={{ color: C.heading }}>
                  Your Design &amp; Measurement
                </h2>

                <p className="mb-0 mt-1 shrink-0 text-[11px] text-slate-600">
                  Viewing:{" "}
                  {activeOrder
                    ? (typeof activeOrder.garmentType === "string" && activeOrder.garmentType.trim()
                        ? activeOrder.garmentType
                        : profileContextGarmentLabel(activeOrder))
                    : "No order selected"}
                </p>

                <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                  <MeasurementProfileAccordion
                    key={profileFromOrder ? orderIdentity(activeOrder) || "order" : "wizard"}
                    profileFromOrder={profileFromOrder}
                    ordersLoading={ordersLoading}
                    ordersLength={orders.length}
                  />
                </div>

                <div className="mt-3 flex shrink-0 justify-end border-t border-white/30 pt-3">
                  <button
                    type="button"
                    onClick={() => navigate("/features/measurement-wizard")}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-md transition-all duration-200 ease-out hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2"
                    style={{ backgroundColor: C.green }}
                  >
                    Update Measurements
                  </button>
                </div>
              </section>

              <div className="h-full min-h-0 w-full">
                <StyleInspirationCard latestOrder={activeOrder} />
              </div>

              <div className="h-full min-h-0 w-full">
                <HelpSupportCard orders={orders} onTrackOrder={scrollToRecentOrders} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
