import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Ruler, X } from "lucide-react";

/**
 * Entry from Browse: send the customer through the Measurement Wizard so the tailor gets full design + measurements.
 */
export default function SendRequestModal({ open, tailor, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !tailor) return null;

  const tailorName = typeof tailor.name === "string" ? tailor.name : "Tailor";

  function goToWizard() {
    onClose();
    navigate("/features/measurement-wizard", {
      state: {
        browseTailor: {
          id: tailor.id,
          name: tailor.name,
          city: tailor.city,
          specialty: tailor.specialty,
          tailorShopId: tailor.tailorShopId,
        },
        startWizardFresh: true,
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-request-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="send-request-title" className="text-lg font-bold text-slate-900">
              Request this tailor
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              You&apos;re starting an order for{" "}
              <span className="font-semibold text-emerald-800">{tailorName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-sm leading-relaxed text-slate-700">
          Use the <span className="font-semibold text-slate-900">Measurement Wizard</span> to add garment type,
          measurements, style options, reference photos, and design notes — everything is saved on the order so your
          tailor sees the full picture.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={goToWizard}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
          >
            <Ruler className="h-4 w-4 shrink-0" aria-hidden />
            Continue to measurement wizard
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-1"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
