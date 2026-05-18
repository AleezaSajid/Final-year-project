import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TD_GLASS_CARD, TD_INPUT_CLASS, TD_REJECT_BUTTON_CLASS } from "../tailorDashboardClassNames";

export const REJECT_QUICK_REASONS = [
  "Fully booked",
  "Not available",
  "Design not supported",
  "Out of service area",
  "Other",
];

export default function RejectOrderModal({
  open,
  orderLabel = "this request",
  busy = false,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [selectedQuick, setSelectedQuick] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setSelectedQuick("");
    }
  }, [open]);

  const handleQuickReason = (label) => {
    setSelectedQuick(label);
    if (label === "Other") {
      setReason("");
      return;
    }
    setReason(label);
  };

  const resolvedReason =
    selectedQuick && selectedQuick !== "Other" ? selectedQuick : reason.trim();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-order-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !busy && onClose?.()}
      />
      <div className={`relative z-10 w-full max-w-md ${TD_GLASS_CARD}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="reject-order-title" className="text-lg font-bold text-[#1F2933]">
              Reject order request?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">
              The customer will see that {orderLabel} was declined. You can add an optional note below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose?.()}
            className="rounded-lg p-1 text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#1F2933]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          Quick reason (optional)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REJECT_QUICK_REASONS.map((label) => {
            const active = selectedQuick === label;
            return (
              <button
                key={label}
                type="button"
                disabled={busy}
                onClick={() => handleQuickReason(label)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-rose-300/80 bg-rose-50/90 text-rose-800 shadow-sm"
                    : "border-[#E5E7EB] bg-white/80 text-[#4B5563] hover:border-rose-200/70 hover:bg-rose-50/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(selectedQuick === "Other" || !selectedQuick) && (
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            {selectedQuick === "Other" ? "Details (optional)" : "Custom note (optional)"}
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (selectedQuick && selectedQuick !== "Other") setSelectedQuick("");
              }}
              rows={3}
              maxLength={500}
              placeholder="e.g. Fully booked this week"
              className={`${TD_INPUT_CLASS} mt-1.5 resize-none`}
              disabled={busy}
            />
          </label>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={busy}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#1F2933] shadow-sm transition hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.(resolvedReason)}
            className={TD_REJECT_BUTTON_CLASS}
          >
            {busy ? "Rejecting…" : "Reject order"}
          </button>
        </div>
      </div>
    </div>
  );
}
