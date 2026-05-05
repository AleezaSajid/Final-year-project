import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardNavbar from "./components/DashboardNavbar";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import { notifyChatIdsFromOrderUpdated, publishChatRoomCustomerId } from "./chatUtils.js";
import { TAILOR_SESSION_STORAGE_KEY } from "./utils/chatIdentity.js";

const API_BASE_URL = "http://localhost:5000";

const TESTIMONIALS_STORAGE_KEY = "sewserve_testimonials";

const C = {
  heading: "#1a1a1a",
};

const GLASS_CARD =
  "overflow-hidden rounded-2xl border border-white/40 bg-white/45 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14)] backdrop-blur-xl";

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

export default function CustomerReviewPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);

  const [customerRating, setCustomerRating] = useState(0);
  const [customerComment, setCustomerComment] = useState("");
  const [decision, setDecision] = useState("Approve");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeOrder = useMemo(
    () =>
      order || {
        id: orderId,
        customerId: "",
        customerName: "You",
        garmentType: "Garment",
        status: "",
        review: {},
      },
    [order, orderId]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchOrder = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);
        if (!response.ok) {
          if (isMounted) setOrder(null);
          return;
        }
        const data = await response.json();
        if (!isMounted || !data) return;
        setOrder({
          ...data,
          id: data._id || data.id,
        });
      } catch {
        if (isMounted) setOrder(null);
      } finally {
        if (isMounted) setIsLoadingOrder(false);
      }
    };

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (isLoadingOrder) return;
    if (!order) return;
    const s = String(order.status || "").toLowerCase();
    const canReview =
      s === "delivered" || s === "completed" || s.includes("complete");
    if (!canReview) navigate("/customer/dashboard");
  }, [isLoadingOrder, navigate, order]);

  useEffect(() => {
    if (!order) return;
    setCustomerRating(Number(safeOrder.customerReview?.rating) || 0);
    setCustomerComment(safeOrder.customerReview?.comment || "");
    setDecision(safeOrder.customerReview?.decision || "Approve");
  }, [order, safeOrder.customerReview]);

  useEffect(() => {
    if (!order?.customerId) return;
    const id = String(order.customerId).trim();
    if (id) publishChatRoomCustomerId(id);
    try {
      const tid = order.tailorId != null ? String(order.tailorId).trim() : "";
      if (tid) localStorage.setItem(TAILOR_SESSION_STORAGE_KEY, tid);
    } catch {
      /* ignore */
    }
    notifyChatIdsFromOrderUpdated();
  }, [order]);

  const submitCustomerReview = async () => {
    if (!safeOrder?.id) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${safeOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerReview: {
            rating: customerRating,
            comment: customerComment,
            decision,
            reviewedAt: new Date().toISOString(),
          },
          status: decision === "Approve" ? "completed" : "needs_alteration",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      try {
        const name =
          (typeof safeOrder.customerName === "string" && safeOrder.customerName.trim()) || "Customer";
        const feedback = String(customerComment || "").trim();
        if (feedback) {
          const avatarSeed = encodeURIComponent(String(safeOrder.id || "review"));
          const entry = {
            name,
            feedback,
            avatar: `https://i.pravatar.cc/64?u=${avatarSeed}`,
            rating: Number(customerRating) || 0,
            createdAt: new Date().toISOString(),
            orderId: String(safeOrder.id || ""),
          };
          const raw = localStorage.getItem(TESTIMONIALS_STORAGE_KEY);
          const prev = raw ? JSON.parse(raw) : [];
          const list = Array.isArray(prev) ? prev : [];
          const deduped = list.filter(
            (t) => !(t && t.orderId && String(t.orderId) === entry.orderId) && !(t && t.feedback === entry.feedback)
          );
          localStorage.setItem(TESTIMONIALS_STORAGE_KEY, JSON.stringify([entry, ...deduped].slice(0, 12)));
          window.dispatchEvent(new CustomEvent("sewserve:testimonials-updated"));
        }
      } catch {
        /* ignore */
      }

      alert("Review submitted successfully");
      navigate("/customer/dashboard");
    } catch {
      alert("Could not submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingOrder) {
    return (
      <div
        className="relative isolate min-h-screen overflow-x-hidden antialiased"
        style={{ backgroundColor: "#eceff3" }}
      >
        <LandingStylePageBackground />
        <DashboardNavbar />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-[72px] text-sm text-slate-500 sm:px-6 lg:px-8">
          Loading order…
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div
        className="relative isolate min-h-screen overflow-x-hidden antialiased"
        style={{ backgroundColor: "#eceff3" }}
      >
        <LandingStylePageBackground />
        <DashboardNavbar />
        <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-[72px] sm:px-6 lg:px-8 lg:py-20">
          <div className={`p-5 sm:p-6 ${GLASS_CARD}`}>
            <p className="text-sm text-slate-600">Order not found.</p>
            <button
              type="button"
              onClick={() => navigate("/customer/dashboard")}
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="relative isolate min-h-screen overflow-x-hidden antialiased"
      style={{ backgroundColor: "#eceff3" }}
    >
      <LandingStylePageBackground />
      <DashboardNavbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
        <button
          type="button"
          onClick={() => navigate("/customer/dashboard")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 transition hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
        >
          ← Back to Dashboard
        </button>
        <section className={`p-5 sm:p-6 ${GLASS_CARD}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Dashboard / Orders / Customer Review
          </p>
          <h1 className="mt-2 text-apple-h3 font-semibold" style={{ color: C.heading }}>
            Customer Review
          </h1>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p className="text-slate-700">
              <span className="font-semibold" style={{ color: C.heading }}>
                Order ID:
              </span>{" "}
              {safeOrder.id || "N/A"}
            </p>
            <p className="text-slate-700">
              <span className="font-semibold" style={{ color: C.heading }}>
                Customer:
              </span>{" "}
              {safeOrder.customerName || safeOrder.customerId || "N/A"}
            </p>
            <p className="text-slate-700">
              <span className="font-semibold" style={{ color: C.heading }}>
                Garment:
              </span>{" "}
              {safeOrder.garmentType || "N/A"}
            </p>
            <p className="text-slate-700">
              <span className="font-semibold" style={{ color: C.heading }}>
                Status:
              </span>{" "}
              {statusLabel(safeOrder.status)}
            </p>
          </div>
        </section>

        <section className={`mt-6 p-5 sm:p-6 ${GLASS_CARD}`}>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg" style={{ color: C.heading }}>
            Tailor Review (Read-only)
          </h2>
          {safeOrder.review ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="font-semibold" style={{ color: C.heading }}>
                  Rating:
                </span>{" "}
                {Number(safeOrder.review?.rating) > 0 ? "★".repeat(Number(safeOrder.review?.rating)) : "Not provided"}
              </p>
              <p>
                <span className="font-semibold" style={{ color: C.heading }}>
                  Review Status:
                </span>{" "}
                {safeOrder.review?.reviewStatus || "Not provided"}
              </p>
              <p>
                <span className="font-semibold" style={{ color: C.heading }}>
                  Notes:
                </span>{" "}
                {safeOrder.review?.notes || "Not provided"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Waiting for tailor review…</p>
          )}
        </section>

        <section className={`mt-6 p-5 sm:p-6 ${GLASS_CARD}`}>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg" style={{ color: C.heading }}>
            Your Review
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: C.heading }}>
                Rating
              </p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCustomerRating(value)}
                    className={`text-2xl transition ${
                      value <= customerRating ? "text-emerald-700" : "text-slate-300"
                    }`}
                    aria-label={`Set customer rating ${value}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold" style={{ color: C.heading }} htmlFor="customer-decision">
                Decision
              </label>
              <select
                id="customer-decision"
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option>Approve</option>
                <option>Request Changes</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold" style={{ color: C.heading }} htmlFor="customer-comment">
                Comment
              </label>
              <textarea
                id="customer-comment"
                value={customerComment}
                onChange={(event) => setCustomerComment(event.target.value)}
                placeholder="Add your comments..."
                className="mt-2 h-24 w-full resize-y rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-white/30 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={submitCustomerReview}
              className="rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
            >
              {isSubmitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
