import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Package, RotateCcw, Headphones, ChevronDown } from "lucide-react";

import LandingNavbar from "./components/LandingNavbar.jsx";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;
const HERO_BG = `${process.env.PUBLIC_URL || ""}/images/hero/sewing-side.png`;
const STYLE_GUIDE_IMG = `${process.env.PUBLIC_URL || ""}/images/hero/mannequin.png`;

/** Design tokens — match dashboard mockup */
const C = {
  heading: "#1a1a1a",
  green: "#4c7c4c",
  greenDark: "#3d6b4a",
  yellow: "#e1a92a",
  redBrown: "#c25441",
};

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

/** Exact rows from design mockup */
const RECENT_ORDERS_MOCK = [
  { orderId: "#SS12458", item: "Custom Suit", delivery: "April 20, 2026", variant: "inTransit" },
  { orderId: "#SS12399", item: "Bridal Dress", delivery: "April 10, 2026", variant: "delivered" },
  { orderId: "#SS12254", item: "Shirt & Trousers", delivery: "March 28, 2026", variant: "returned" },
];

const MEASUREMENTS_MOCK = {
  chest: "38",
  waist: "32",
  hips: "40",
  sleeve: "24",
};

function StatusPill({ variant }) {
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
  if (variant === "returned") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(194, 84, 65, 0.15)", color: C.redBrown }}
      >
        Returned
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
        <h3 className={`text-[15px] font-bold leading-snug ${titleClassName}`} style={{ color: titleClassName ? undefined : C.heading }}>
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

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);

  const displayName = useMemo(() => {
    try {
      return localStorage.getItem("sewserve_display_name")?.trim() || "Sarah";
    } catch {
      return "Sarah";
    }
  }, []);

  const handleSectionNavigate = (sectionId) => {
    navigate("/", { state: { scrollTo: sectionId } });
  };

  const handleDashboardNavigate = () => {};

  return (
    <div id="home" className="relative isolate min-h-screen antialiased" style={{ backgroundColor: "#eceff3" }}>
      <LandingStylePageBackground />

      <style>
        {`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.ss-nav-underline { position: relative; }
.ss-nav-underline::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -6px;
  height: 2px;
  width: 0;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3d6b4a, #4a7c59);
  transition: width 0.28s ease;
}
.ss-nav-underline:hover::after,
.ss-nav-underline:focus-visible::after { width: 100%; }
.ss-glass-surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(15, 23, 42, 0.04);
}
`}
      </style>

      <div className="relative z-10 font-['Inter',sans-serif] text-slate-600">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
          onDashboardNavigate={handleDashboardNavigate}
          trackOrdersInNavCenter
        />

        <main className="w-full">
          {/* Hero — soft fabric photography */}
          <section className="relative overflow-hidden border-b border-white/40">
            <div
              className="absolute inset-0 scale-105 bg-cover bg-center blur-[0.5px]"
              style={{ backgroundImage: `url(${HERO_BG})` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/82 via-white/65 to-[#eceff3]/95" aria-hidden />
            <div className="relative mx-auto max-w-7xl px-4 py-[72px] sm:px-6 sm:py-20 lg:px-10 lg:py-[88px]">
              <h1
                className="max-w-3xl text-apple-h1 font-bold tracking-tight"
                style={{ color: C.heading }}
              >
                Hi {displayName}, Good to see you back!
              </h1>
              <p className="mt-2.5 max-w-xl text-base leading-[1.6] text-ink-muted">
                Here&apos;s a quick look at your order status.
              </p>
            </div>
          </section>

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
                icon={RotateCcw}
                iconBgClass="bg-slate-200"
                iconClass="text-[#1e3a5f]"
                title="Returned"
                titleClassName=""
                description="Your order has been returned."
                badgeLabel="Returned"
                badgeStyle={{ backgroundColor: C.redBrown }}
                footerTintClass="bg-slate-100/90"
              />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              {/* Recent Orders — exact mock table */}
              <section
                className="rounded-apple-card border border-gray-200/90 bg-white p-5 shadow-sm sm:p-6 lg:col-span-7"
                style={{ boxShadow: "0 4px 24px -6px rgba(15, 23, 42, 0.08)" }}
              >
                <h2 className="text-apple-h3 font-semibold" style={{ color: C.heading }}>
                  Recent Orders
                </h2>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Order ID</th>
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Item</th>
                        <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                        <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RECENT_ORDERS_MOCK.map((row) => (
                        <tr key={row.orderId} className="border-b border-gray-100 last:border-0">
                          <td className="py-3.5 pr-4 font-medium" style={{ color: C.heading }}>
                            {row.orderId}
                          </td>
                          <td className="py-3.5 pr-4 text-slate-700">{row.item}</td>
                          <td className="py-3.5 pr-4">
                            <StatusPill variant={row.variant} />
                          </td>
                          <td className="py-3.5 text-slate-600">{row.delivery}</td>
                        </tr>
                      ))}
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
                  className="rounded-apple-card border-2 border-sky-100 bg-white p-5 sm:p-6"
                  style={{ boxShadow: "0 4px 24px -6px rgba(15, 23, 42, 0.08)" }}
                >
                  <h2 className="text-apple-h3 font-semibold" style={{ color: C.heading }}>
                    Your Measurements
                  </h2>
                  <dl className="mt-4 space-y-0 text-sm">
                    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5">
                      <dt className="text-slate-500">Chest</dt>
                      <dd className="font-medium" style={{ color: C.heading }}>
                        {MEASUREMENTS_MOCK.chest} in
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5">
                      <dt className="text-slate-500">Waist</dt>
                      <dd className="font-medium" style={{ color: C.heading }}>
                        {MEASUREMENTS_MOCK.waist} in
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5">
                      <dt className="text-slate-500">Hips</dt>
                      <dd className="font-medium" style={{ color: C.heading }}>
                        {MEASUREMENTS_MOCK.hips} in
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 py-2.5">
                      <dt className="text-slate-500">Sleeve Length</dt>
                      <dd className="font-medium" style={{ color: C.heading }}>
                        {MEASUREMENTS_MOCK.sleeve} in
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex justify-end">
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
                  <div
                    className="overflow-hidden rounded-apple-card border border-gray-200/90 bg-white p-5 shadow-sm"
                    style={{ boxShadow: "0 4px 20px -6px rgba(15, 23, 42, 0.08)" }}
                  >
                    <div className="flex gap-3">
                      <div className="relative h-[72px] w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        <img
                          src={STYLE_GUIDE_IMG}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold leading-tight" style={{ color: C.heading }}>
                          Style Guide &amp; Tips
                        </h3>
                        <p className="mt-1.5 text-[12px] leading-snug text-slate-600">
                          Get fashion advice and inspiration.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate({ pathname: "/", hash: "#contact" })}
                    className="flex h-full flex-col items-start gap-2 overflow-hidden rounded-apple-card border border-gray-200/90 bg-white p-5 text-left shadow-sm transition-all duration-200 ease-out hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
                    style={{ boxShadow: "0 4px 20px -6px rgba(15, 23, 42, 0.08)" }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#1e3a5f]">
                      <Headphones className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold" style={{ color: C.heading }}>
                        Support Center
                      </h3>
                      <p className="mt-1 text-[12px] leading-snug text-slate-600">
                        We&apos;re help to help with any uquestions.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
