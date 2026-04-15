import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FaTwitter } from "react-icons/fa6";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { SewServeBrandImg } from "./components/SewServeBrandImg.jsx";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import LandingNavbar from "./components/LandingNavbar.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
import { Check, Scissors, Truck } from "lucide-react";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

/** Placeholder order for the tracking UI until real data is wired in */
const DEMO_ORDER = {
  id: "123456",
  status: "In Progress",
  progress: 50,
  date: "2026-04-05",
};

const sectionReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

/** Maps order progress to UI phases matching the track-order mockup */
function getTrackingPhases(order) {
  if (!order) {
    return {
      m: "completed",
      t: "active",
      d: "pending",
      line12: "active",
      line23: "pending",
    };
  }
  const p = order.progress ?? 0;
  const done = order.status === "Completed" || p >= 100;
  if (done) {
    return { m: "completed", t: "completed", d: "completed", line12: "done", line23: "done" };
  }
  if (p >= 66) {
    return { m: "completed", t: "completed", d: "active", line12: "done", line23: "active" };
  }
  if (p >= 33) {
    return { m: "completed", t: "active", d: "pending", line12: "active", line23: "pending" };
  }
  return { m: "active", t: "pending", d: "pending", line12: "pending", line23: "pending" };
}

function formatLongDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function expectedDeliveryIso(orderDate) {
  const d = new Date(`${orderDate || new Date().toISOString().slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + 10);
  return d.toISOString().slice(0, 10);
}

/** Matches track-order card mock: 3 rows, dividers, gradient icon band, centered copy, pill badge */
const TRACK_CARD_THEME = {
  completed: {
    headerGradient: "from-sky-100/90 via-sky-50/40 to-white",
    iconRing: "bg-[#2D7A5E]",
    title: "text-[#2D7A5E]",
    badge: "bg-[#2D7A5E] text-white",
  },
  active: {
    headerGradient: "from-amber-50/95 via-amber-50/30 to-white",
    iconRing: "bg-[#C9A227]",
    title: "text-[#B8860B]",
    badge: "bg-[#C9A227] text-white",
  },
  pending: {
    headerGradient: "from-slate-100/90 via-slate-50/50 to-white",
    iconRing: "bg-slate-300",
    title: "text-slate-600",
    badge: "bg-slate-200 text-slate-700",
  },
};

function phaseBadgeLabel(phase) {
  if (phase === "completed") return "Completed";
  if (phase === "active") return "In Progress";
  return "Pending";
}

function TrackStatusCard({ tone, title, description, children }) {
  const theme = TRACK_CARD_THEME[tone] ?? TRACK_CARD_THEME.pending;
  return (
    <div className="flex flex-col overflow-hidden rounded-apple-card border border-gray-100 bg-white shadow-lg">
      <div
        className={`flex justify-center border-b border-gray-100 bg-gradient-to-b px-5 py-5 sm:py-6 ${theme.headerGradient}`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md ring-1 ring-black/5 ${theme.iconRing}`}
        >
          {children}
        </div>
      </div>
      <div className="border-b border-gray-100 bg-white px-5 py-4 text-center sm:px-6 sm:py-5">
        <h3 className={`text-apple-h3 font-semibold ${theme.title}`}>{title}</h3>
        <p className="mt-2.5 text-base font-normal leading-[1.6] text-ink-muted">{description}</p>
      </div>
      <div className="flex justify-center bg-white px-5 py-4">
        <span className={`inline-flex rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide ${theme.badge}`}>
          {phaseBadgeLabel(tone)}
        </span>
      </div>
    </div>
  );
}

function SewServeFooter() {
  return (
    <footer id="contact" className="border-t border-gray-100 bg-white py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <a
            href="#home"
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]"
            aria-label="SewServe — home"
          >
            <SewServeBrandImg
              decorative
              className="h-7 max-h-8 w-auto max-w-[min(200px,52vw)] object-contain drop-shadow-[0_2px_8px_rgba(20,44,77,0.12)]"
            />
          </a>
          <div className="flex flex-wrap gap-5 text-sm text-[#4B5563]">
            <a href="#" className="transition hover:text-[#556B2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]">Company</a>
            <a href="#" className="transition hover:text-[#556B2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]">Privacy</a>
            <a href="#contact" className="transition hover:text-[#556B2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]">Support</a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="rounded-full border border-gray-200 p-2 text-[#1877F2] transition hover:border-[#BAC095] hover:bg-[#F0F5E1] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]"
            >
              <SiFacebook className="h-4 w-4 shrink-0" aria-hidden />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="rounded-full border border-gray-200 p-2 text-[#E4405F] transition hover:border-[#BAC095] hover:bg-[#F0F5E1] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]"
            >
              <SiInstagram className="h-4 w-4 shrink-0" aria-hidden />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="rounded-full border border-gray-200 p-2 text-[#1DA1F2] transition hover:border-[#BAC095] hover:bg-[#F0F5E1] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#BAC095]"
            >
              <FaTwitter className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
        <p className="text-sm text-[#4B5563]">© 2026 SewServe. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default function OrderTrackingPage() {
  const navigate = useNavigate();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);

  const displayOrder = DEMO_ORDER;
  const phases = getTrackingPhases(displayOrder);

  const handleSectionNavigate = (sectionId) => {
    navigate("/", { state: { scrollTo: sectionId } });
  };

  const handleDashboardNavigate = () => {
    const token =
      localStorage.getItem("sewserve_auth_token") || sessionStorage.getItem("sewserve_auth_token");
    if (token) {
      navigate("/select-workspace");
    } else {
      navigate("/login");
    }
  };

  useEffect(() => {
    document.title = "SewServe | Track Your Order";
    const description = "Follow your tailoring order from measurements through delivery.";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", description);

    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      document.head.appendChild(favicon);
    }
    favicon.setAttribute("href", "/favicon.ico");
  }, []);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  const expectedDel = expectedDeliveryIso(displayOrder?.date);
  const orderRef = displayOrder?.id != null ? `#SS${String(displayOrder.id).replace(/^#/, "")}` : "#SS—";

  const seg12Green = phases.line12 === "done" || phases.line12 === "active";
  const seg23Green = phases.line23 === "done" || phases.line23 === "active";

  return (
    <div className="relative isolate min-h-screen bg-transparent text-[#6B7280] antialiased">
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

      <div className="relative z-10 font-['Inter',sans-serif]">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
          onDashboardNavigate={handleDashboardNavigate}
        />

        <main id="home">
          <motion.section
            id="order-tracking"
            className="relative isolate px-4 py-[72px] sm:px-6 md:py-[88px] lg:px-8"
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            <div className="mx-auto w-full max-w-6xl">
              <div className="text-center">
                <h1 className="text-balance text-apple-h1 font-bold tracking-tight text-ink">
                  Track Your Order
                </h1>
                <p className="mx-auto mt-2.5 max-w-2xl text-base leading-[1.6] text-ink-muted sm:text-[1rem]">
                  Follow the progress of your order from start to finish.
                </p>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-12 lg:gap-8">
                <TrackStatusCard
                  tone={phases.m}
                  title="Measurement Received"
                  description="Your measurements have been recorded."
                >
                  <Check
                    className={`h-6 w-6 ${phases.m === "pending" ? "text-slate-600" : "text-white"}`}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </TrackStatusCard>

                <TrackStatusCard
                  tone={phases.t}
                  title="Tailoring in Progress"
                  description="Your garment is currently being tailored."
                >
                  <Scissors
                    className={`h-6 w-6 ${phases.t === "pending" ? "text-slate-600" : "text-white"}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </TrackStatusCard>

                <TrackStatusCard
                  tone={phases.d}
                  title="Ready for Delivery"
                  description="Your order is almost ready for dispatch."
                >
                  <Truck
                    className={`h-6 w-6 ${phases.d === "pending" ? "text-slate-600" : "text-white"}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </TrackStatusCard>
              </div>

              {/* Horizontal timeline */}
              <div className="mx-auto mt-12 max-w-4xl px-2 lg:mt-16">
                <div className="relative flex items-start justify-between">
                  <div className="absolute left-[16%] right-[16%] top-[18px] z-0 flex h-0.5 -translate-y-1/2">
                    <div className={`h-full flex-1 ${seg12Green ? "bg-[#2D7A5E]" : "bg-slate-300"}`} />
                    <div className={`h-full flex-1 ${seg23Green ? "bg-[#2D7A5E]" : "bg-slate-300"}`} />
                  </div>

                  <div className="relative z-10 flex w-[30%] flex-col items-center text-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-4 ring-white ${
                        phases.m === "completed" ? "bg-[#2D7A5E]" : phases.m === "active" ? "bg-[#C9A227]" : "bg-slate-300"
                      }`}
                    >
                      <Check className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
                    </div>
                    <p className="mt-3 text-xs font-medium text-[#374151] sm:text-sm">Measurements Received</p>
                  </div>
                  <div className="relative z-10 flex w-[30%] flex-col items-center text-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-4 ring-white ${
                        phases.t === "completed" ? "bg-[#2D7A5E]" : phases.t === "active" ? "bg-[#C9A227]" : "bg-slate-300"
                      }`}
                    >
                      <Check className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
                    </div>
                    <p
                      className={`mt-3 text-xs font-semibold sm:text-sm ${
                        phases.t === "active" ? "text-[#B8860B]" : "text-[#374151]"
                      }`}
                    >
                      Tailoring in Progress
                    </p>
                  </div>
                  <div className="relative z-10 flex w-[30%] flex-col items-center text-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-4 ring-white ${
                        phases.d === "completed" ? "bg-[#2D7A5E]" : phases.d === "active" ? "bg-[#C9A227]" : "bg-slate-300"
                      }`}
                    >
                      <Check className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
                    </div>
                    <p className="mt-3 text-xs font-medium text-[#374151] sm:text-sm">Out for Delivery</p>
                  </div>
                </div>
              </div>

              {/* Order details + support */}
              <div className="mx-auto mt-14 max-w-5xl rounded-apple-card border border-slate-100 bg-white/90 px-5 py-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:px-6 sm:py-8 md:px-10 lg:mt-16">
                <div className="grid gap-10 md:grid-cols-2 md:gap-0">
                  <div className="md:pr-10">
                    <h2 className="text-apple-h3 font-semibold text-ink">Order Details</h2>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium text-ink-muted">Order Number</dt>
                        <dd className="font-semibold text-ink">{orderRef}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium text-ink-muted">Order Date</dt>
                        <dd className="font-semibold text-ink">{formatLongDate(displayOrder?.date)}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium text-ink-muted">Expected Delivery</dt>
                        <dd className="font-semibold text-ink">{formatLongDate(expectedDel)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="relative border-t border-slate-200 pt-10 md:border-l md:border-t-0 md:pl-10 md:pt-0">
                    <h2 className="text-apple-h3 font-semibold text-ink">Need Help?</h2>
                    <p className="mt-2.5 text-base leading-[1.6] text-ink-muted">Contact our support team for assistance.</p>
                    <button
                      type="button"
                      onClick={() => navigate({ pathname: "/", hash: "#contact" })}
                      className="mt-6 w-full rounded-apple bg-[#3E704D] px-[18px] py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:bg-[#356645] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3E704D] focus-visible:ring-offset-2 md:max-w-xs"
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </main>

        <SewServeFooter />
      </div>
    </div>
  );
}
