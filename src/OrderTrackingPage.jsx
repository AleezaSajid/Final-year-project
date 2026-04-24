import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FaTwitter } from "react-icons/fa6";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { Check } from "lucide-react";
import { SewServeBrandImg } from "./components/SewServeBrandImg.jsx";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import LandingNavbar from "./components/LandingNavbar.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
import {
  getActiveOrderForCustomer,
  getOrderById,
  listOrdersForCustomer,
  normalizeApiOrderDoc,
} from "./api/ordersApi.js";
import { ensureSocketThen, socket } from "./socket";
import { resolveCustomerIdForChat } from "./utils/chatIdentity.js";
import { getOrderActivityMessage } from "./utils/orderActivityMessage.js";
import { internalStatusToTrackingEnum, trackingEnumToProgress } from "./utils/orderLiveStatus.js";
import {
  getNextWorkflowLabel,
  getWorkflowIndexFromOrder,
  isOrderWorkflowCompleted,
  normalizeWorkflowStatus,
  ORDER_WORKFLOW_STEPS,
} from "./utils/orderWorkflow.js";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

const sectionReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

function formatLongDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function expectedDeliveryIso(orderDate) {
  const d = new Date(`${orderDate || new Date().toISOString().slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + 10);
  return d.toISOString().slice(0, 10);
}

function isoFromMaybeDate(val) {
  if (val == null || val === "") return "";
  if (typeof val === "string") return val.slice(0, 10);
  try {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return "";
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

function resolvedWorkflowIndex(order) {
  if (!order) return 0;
  if (isOrderWorkflowCompleted(order)) return ORDER_WORKFLOW_STEPS.length - 1;
  const raw = order.currentStepIndex;
  if (raw != null && String(raw).trim() !== "" && Number.isFinite(Number(raw))) {
    return Math.max(0, Math.min(ORDER_WORKFLOW_STEPS.length - 1, Number(raw)));
  }
  return getWorkflowIndexFromOrder(order);
}

function orderIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a).trim() === String(b).trim();
}

function stepRowState(index, activeIndex, allComplete) {
  if (allComplete) return "completed";
  if (index < activeIndex) return "completed";
  if (index === activeIndex) return "active";
  return "upcoming";
}

export default function OrderTrackingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState(null);
  const [activityMessage, setActivityMessage] = useState("");
  const [, setLiveProgress] = useState(null);
  const [, setCurrentStep] = useState(null);
  const [, setOrderDetails] = useState(null);

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

  const loadOrder = useCallback(async () => {
    const paramId = searchParams.get("orderId") || searchParams.get("id");
    const stateId = location.state?.orderId ?? location.state?.trackingOrderId;
    const explicitId = paramId || stateId;

    setLoading(true);
    try {
      if (explicitId) {
        const doc = await getOrderById(String(explicitId).trim());
        setOrder(normalizeApiOrderDoc(doc));
      } else {
        const cid = resolveCustomerIdForChat(null);
        try {
          const activeDoc = await getActiveOrderForCustomer(cid);
          setOrder(normalizeApiOrderDoc(activeDoc));
        } catch {
          const list = await listOrdersForCustomer(cid);
          const sorted = [...list].sort((a, b) => {
            const ta = new Date(a.createdAt || a.date || 0).getTime();
            const tb = new Date(b.createdAt || b.date || 0).getTime();
            return tb - ta;
          });
          const active = sorted.find((o) => !isOrderWorkflowCompleted(o));
          setOrder(active ? normalizeApiOrderDoc(active) : null);
        }
      }
    } catch (err) {
      console.error(err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [searchParams, location.state]);

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

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order) {
      setOrderStatus(null);
      setLiveProgress(null);
      setCurrentStep(null);
      return;
    }
    const internal = normalizeWorkflowStatus(order.status);
    const track = internalStatusToTrackingEnum(internal);
    if (track) {
      setOrderStatus(track);
      setLiveProgress(trackingEnumToProgress(track));
    } else {
      setOrderStatus(null);
      setLiveProgress(null);
    }
    const idx = getWorkflowIndexFromOrder(order);
    setCurrentStep(Number.isFinite(idx) ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when tracked order fields change
  }, [order?.id, order?.status, order?.currentStepIndex]);

  useEffect(() => {
    if (!order) {
      setOrderDetails(null);
      return;
    }
    const oid = order.id ?? order._id;
    const internal = normalizeWorkflowStatus(order.status);
    const track = internalStatusToTrackingEnum(internal);
    setOrderDetails({
      orderId: oid,
      status: track ?? internal,
      currentStep: order.currentStepIndex ?? getWorkflowIndexFromOrder(order),
      wizardData: order.orderPayload ?? order.wizardData ?? null,
      updatedAt:
        order.updatedAt != null && order.updatedAt !== ""
          ? new Date(order.updatedAt).getTime()
          : Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirror selected fields only
  }, [order?.id, order?.status, order?.currentStepIndex, order?.orderPayload, order?.wizardData, order?.updatedAt]);

  useEffect(() => {
    if (!orderStatus) return;
    setOrderDetails((prev) =>
      prev && typeof prev === "object" ? { ...prev, status: orderStatus } : { status: orderStatus }
    );
  }, [orderStatus]);

  useEffect(() => {
    if (orderStatus) {
      setActivityMessage(getOrderActivityMessage(orderStatus));
    } else {
      setActivityMessage("");
    }
  }, [orderStatus]);

  useEffect(() => {
    if (!order) return;
    const currentOrderId = String(order.id ?? order._id ?? "").trim();
    if (!currentOrderId) return;

    const joinOrderRoom = () => {
      socket.emit("join_order_room", currentOrderId);
    };
    ensureSocketThen(joinOrderRoom);
    socket.on("connect", joinOrderRoom);

    const pullLatestOrder = async (eventPayload) => {
      if (!eventPayload || !orderIdsMatch(eventPayload.orderId, currentOrderId)) return;
      try {
        const doc = await getOrderById(currentOrderId);
        setOrder(normalizeApiOrderDoc(doc));
      } catch {
        void loadOrder();
      }
    };

    const onLiveUpdate = (data) => {
      if (data && orderIdsMatch(data.orderId, currentOrderId)) {
        setOrderStatus(data.status);
        setActivityMessage(getOrderActivityMessage(data.status));
      }
      void pullLatestOrder(data);
    };

    const onStatusUpdatedRelay = (data) => {
      if (data && orderIdsMatch(data.orderId, currentOrderId)) {
        setOrderStatus(data.status);
        setActivityMessage(getOrderActivityMessage(data.status));
      }
      void pullLatestOrder(data);
    };

    const onSync = (data) => {
      if (!data || !orderIdsMatch(data.orderId, currentOrderId)) return;
      void loadOrder();
    };

    socket.on("order:liveUpdate", onLiveUpdate);
    socket.on("order:statusUpdated", onStatusUpdatedRelay);
    socket.on("order:sync", onSync);
    return () => {
      socket.off("connect", joinOrderRoom);
      socket.off("order:liveUpdate", onLiveUpdate);
      socket.off("order:statusUpdated", onStatusUpdatedRelay);
      socket.off("order:sync", onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- room + handlers keyed to order id
  }, [order?.id, order?._id, loadOrder]);

  useEffect(() => {
    const onRefresh = () => {
      void loadOrder();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void loadOrder();
    };
    window.addEventListener("sewserve:orders-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("sewserve:orders-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadOrder]);

  const isDone = useMemo(() => isOrderWorkflowCompleted(order), [order]);
  const activeIdx = useMemo(() => resolvedWorkflowIndex(order), [order]);
  const normStatus = useMemo(() => normalizeWorkflowStatus(order?.status), [order?.status]);

  const orderRef = useMemo(() => {
    if (!order) return "—";
    const raw = order.id ?? order._id;
    if (raw == null || raw === "") return "—";
    return `#SS${String(raw).replace(/^#/, "")}`;
  }, [order]);

  const orderDateDisplay = useMemo(() => {
    if (!order) return "—";
    if (typeof order.orderDate === "string" && order.orderDate.trim() !== "") return order.orderDate.trim();
    const iso = isoFromMaybeDate(order.createdAt ?? order.date);
    return formatLongDate(iso || undefined);
  }, [order]);

  const expectedDeliveryDisplay = useMemo(() => {
    if (!order) return "—";
    if (typeof order.expectedDelivery === "string" && order.expectedDelivery.trim() !== "") {
      return order.expectedDelivery.trim();
    }
    const dueIso = isoFromMaybeDate(order.dueDate);
    if (dueIso) return formatLongDate(dueIso);
    const createdIso = isoFromMaybeDate(order.createdAt ?? order.date);
    return formatLongDate(expectedDeliveryIso(createdIso || undefined));
  }, [order]);

  const currentStageLabel = useMemo(() => {
    if (!order) return "—";
    return ORDER_WORKFLOW_STEPS[activeIdx]?.label ?? "—";
  }, [order, activeIdx]);

  const nextStageLabel = useMemo(() => {
    if (!order) return "—";
    return getNextWorkflowLabel(activeIdx);
  }, [order, activeIdx]);

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

              {loading ? (
                <div className="mt-12 text-center text-ink-muted">Loading…</div>
              ) : !order ? (
                <div className="mt-12 text-center text-ink-muted">No active order found.</div>
              ) : (
                <>
                  <ul className="mx-auto mt-10 max-w-xl space-y-3 lg:mt-12">
                    {ORDER_WORKFLOW_STEPS.map((step, index) => {
                      const rowState = stepRowState(index, activeIdx, isDone);
                      const done = rowState === "completed";
                      const active = rowState === "active";
                      const upcoming = rowState === "upcoming";
                      return (
                        <li
                          key={step.status}
                          className={`flex items-center gap-3 rounded-apple-card border border-gray-100 bg-white px-4 py-3 shadow-lg ${
                            upcoming ? "opacity-50" : ""
                          }`}
                          aria-current={active ? "step" : undefined}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 ${
                              done ? "bg-[#22c55e] text-white" : active ? "bg-[#C9A227] text-white ring-2 ring-amber-300/70" : "bg-slate-200"
                            }`}
                          >
                            {done ? (
                              <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                            ) : active ? (
                              <span className="h-3 w-3 rounded-full bg-white shadow-sm" aria-hidden />
                            ) : (
                              <span className="h-3 w-3 rounded-full bg-slate-400" aria-hidden />
                            )}
                          </span>
                          <span
                            className={`text-sm ${active ? "font-semibold text-ink" : done ? "font-medium text-[#15803d]" : "text-ink-muted"}`}
                          >
                            {step.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

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
                            <dd className="font-semibold text-ink">{orderDateDisplay}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-medium text-ink-muted">Expected Delivery</dt>
                            <dd className="font-semibold text-ink">{expectedDeliveryDisplay}</dd>
                          </div>
                          {normStatus === "completed" ? (
                            <>
                              <p className="text-sm leading-[1.5] text-ink">{activityMessage}</p>
                              <div className="flex flex-wrap gap-x-2">
                                <dt className="font-medium text-ink-muted">Status</dt>
                                <dd className="font-semibold text-ink">Completed ✔</dd>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm leading-[1.5] text-ink">{activityMessage}</p>
                              <div className="flex flex-wrap gap-x-2">
                                <dt className="font-medium text-ink-muted">Current Stage</dt>
                                <dd className="font-semibold text-ink">{currentStageLabel}</dd>
                              </div>
                              <div className="flex flex-wrap gap-x-2">
                                <dt className="font-medium text-ink-muted">Next Stage</dt>
                                <dd className="font-semibold text-ink">{nextStageLabel}</dd>
                              </div>
                            </>
                          )}
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
                </>
              )}
            </div>
          </motion.section>
        </main>

        <SewServeFooter />
      </div>
    </div>
  );
}
