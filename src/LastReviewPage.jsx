import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardNavbar from "./components/DashboardNavbar";
import { PageBackground } from "./components/PageBackground.jsx";

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

export default function LastReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const incomingOrder = location.state?.order || null;
  const [order, setOrder] = useState(incomingOrder);
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

  const details = safeOrder.measurements || {};

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

  return (
    <div className="relative isolate min-h-screen bg-transparent text-[#6B7280]">
      <PageBackground />
      <DashboardNavbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/tailor/dashboard")}
          className="mb-3 text-sm text-orange-600 transition hover:underline"
        >
          ← Back to Dashboard
        </button>
        <section className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-orange-600">Dashboard / Orders / Last Review</p>
          <h1 className="mt-1 text-xl font-semibold text-[#111827]">Last Review</h1>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="font-medium text-[#111827]">Order ID:</span> {safeOrder.id || "N/A"}</p>
            <p><span className="font-medium text-[#111827]">Customer:</span> {safeOrder.customerName || safeOrder.customerId || "N/A"}</p>
            <p><span className="font-medium text-[#111827]">Garment:</span> {safeOrder.garmentType || "N/A"}</p>
            <p><span className="font-medium text-[#111827]">Status:</span> {statusLabel(safeOrder.status)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <button
              type="button"
              onClick={() => navigate(`/chat/${safeOrder.customerId || "customer"}`)}
              className="text-orange-600 transition hover:underline"
            >
              Open Chat
            </button>
            <button
              type="button"
              onClick={() => navigate("/tailor/dashboard")}
              className="text-orange-600 transition hover:underline"
            >
              View All Orders
            </button>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Garment Preview</h2>
            <div className="mt-3">
              {images.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {images.map((img, index) => (
                    <div key={`${img}-${index}`} className="rounded-lg border border-gray-100 bg-orange-50 p-3 text-xs text-gray-600">
                      {img}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-orange-50 p-6 text-center text-sm text-gray-500">
                  No preview available
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Tailor Notes</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p><span className="font-medium text-[#111827]">Fabric:</span> {details.fabric || "Not provided"}</p>
              <p><span className="font-medium text-[#111827]">Adjustments:</span> {details.adjustments || "Not provided"}</p>
              <p><span className="font-medium text-[#111827]">Special Instructions:</span> {details.specialInstructions || safeOrder.notes || "Not provided"}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#111827]">Final Quality Review</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-[#111827]">Quality Rating</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`text-2xl transition ${value <= rating ? "text-orange-600" : "text-gray-300"}`}
                    aria-label={`Set rating ${value}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#111827]" htmlFor="review-status">Review Status</label>
              <select
                id="review-status"
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option>Passed</option>
                <option>Needs Alteration</option>
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="text-sm font-medium text-[#111827]" htmlFor="internal-notes">Internal Notes</label>
              <textarea
                id="internal-notes"
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Add final inspection notes..."
                className="mt-2 h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
        </section>
      </main>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => updateStatusAndReturn("needs_alteration")}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            Request Alteration
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => updateStatusAndReturn("completed")}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-60"
          >
            Confirm Delivery
          </button>
        </div>
      </div>
    </div>
  );
}
