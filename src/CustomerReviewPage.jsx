import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardNavbar from "./components/DashboardNavbar";
import { PageBackground } from "./components/PageBackground.jsx";

const API_BASE_URL = "http://localhost:5000";

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
    if (order && String(order.status || "").toLowerCase() !== "last_review") {
      navigate("/customer/dashboard");
    }
  }, [isLoadingOrder, navigate, order]);

  useEffect(() => {
    if (!order) return;
    setCustomerRating(Number(safeOrder.customerReview?.rating) || 0);
    setCustomerComment(safeOrder.customerReview?.comment || "");
    setDecision(safeOrder.customerReview?.decision || "Approve");
  }, [order, safeOrder.customerReview]);

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
      <div className="relative isolate min-h-screen bg-transparent p-6 text-sm text-gray-500">
        <PageBackground />
        <span className="relative z-10">Loading order...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="relative isolate min-h-screen bg-transparent text-[#4B5563]">
        <PageBackground />
        <DashboardNavbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#E7EED0] bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Order not found</p>
            <button
              type="button"
              onClick={() => navigate("/customer/dashboard")}
              className="mt-3 rounded-lg border border-[#BAC095] px-3 py-1.5 text-xs font-semibold text-[#3D4127] transition hover:bg-[#F0F5E1]"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-transparent text-[#4B5563]">
      <PageBackground />
      <DashboardNavbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/customer/dashboard")}
          className="mb-3 text-sm text-[#556B2F] transition hover:underline"
        >
          ← Back to Dashboard
        </button>
        <section className="rounded-2xl border border-[#E7EED0] bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#636B2F]">Dashboard / Orders / Customer Review</p>
          <h1 className="mt-1 text-xl font-semibold text-[#2F3A20]">Customer Review</h1>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="font-medium text-[#2F3A20]">Order ID:</span> {safeOrder.id || "N/A"}</p>
            <p><span className="font-medium text-[#2F3A20]">Customer:</span> {safeOrder.customerName || safeOrder.customerId || "N/A"}</p>
            <p><span className="font-medium text-[#2F3A20]">Garment:</span> {safeOrder.garmentType || "N/A"}</p>
            <p><span className="font-medium text-[#2F3A20]">Status:</span> {statusLabel(safeOrder.status)}</p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[#E7EED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#2F3A20]">Tailor Review (Read-only)</h2>
          {safeOrder.review ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="font-medium text-[#2F3A20]">Rating:</span>{" "}
                {Number(safeOrder.review?.rating) > 0 ? "★".repeat(Number(safeOrder.review?.rating)) : "Not provided"}
              </p>
              <p><span className="font-medium text-[#2F3A20]">Review Status:</span> {safeOrder.review?.reviewStatus || "Not provided"}</p>
              <p><span className="font-medium text-[#2F3A20]">Notes:</span> {safeOrder.review?.notes || "Not provided"}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">Waiting for tailor review...</p>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-[#E7EED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#2F3A20]">Your Approval</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-[#2F3A20]">Rating</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCustomerRating(value)}
                    className={`text-2xl transition ${value <= customerRating ? "text-[#636B2F]" : "text-gray-300"}`}
                    aria-label={`Set customer rating ${value}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#2F3A20]" htmlFor="customer-decision">Decision</label>
              <select
                id="customer-decision"
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#BAC095]"
              >
                <option>Approve</option>
                <option>Request Changes</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#2F3A20]" htmlFor="customer-comment">Comment</label>
              <textarea
                id="customer-comment"
                value={customerComment}
                onChange={(event) => setCustomerComment(event.target.value)}
                placeholder="Add your comments..."
                className="mt-2 h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#BAC095]"
              />
            </div>
          </div>
        </section>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={submitCustomerReview}
            className="rounded-lg bg-[#636B2F] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Submit Review
          </button>
        </div>
      </main>
    </div>
  );
}
