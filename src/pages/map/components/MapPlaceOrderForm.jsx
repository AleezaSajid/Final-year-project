import { useState } from "react";

/**
 * Compact place-order form for map flow — field styling matches MapPanelToolbar inputs (no new visual language).
 */
export default function MapPlaceOrderForm({ onSubmit, onCancel }) {
  const [garmentType, setGarmentType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const g = garmentType.trim();
    if (!g) {
      setError("Garment / order type is required.");
      return;
    }
    setError("");
    onSubmit({
      garmentType: g,
      dueDate: dueDate.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <section className="scroll-mt-24" aria-label="Place order">
      <div className="ss-glass-card rounded-apple-card p-5 shadow-sm shadow-slate-900/5 sm:p-6">
        <h2 className="font-['Playfair_Display',Georgia,serif] text-xl font-semibold tracking-tight text-ink">
          Order details
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="map-order-garment" className="text-sm font-medium text-ink-muted">
              Garment / order type
            </label>
            <input
              id="map-order-garment"
              type="text"
              value={garmentType}
              onChange={(e) => setGarmentType(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-white/30 bg-white/70 py-3 px-3 text-sm font-medium text-ink shadow-sm backdrop-blur-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              placeholder="e.g. Bridal lehenga alterations"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="map-order-due" className="text-sm font-medium text-ink-muted">
              Preferred due date
            </label>
            <input
              id="map-order-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-white/30 bg-white/70 py-3 px-3 text-sm font-medium text-ink shadow-sm backdrop-blur-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          <div>
            <label htmlFor="map-order-notes" className="text-sm font-medium text-ink-muted">
              Notes (optional)
            </label>
            <textarea
              id="map-order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-y rounded-2xl border border-white/30 bg-white/70 py-3 px-3 text-sm font-medium text-ink shadow-sm backdrop-blur-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              placeholder="Measurements, fabric, special requests…"
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              className="hero-cta inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 bg-gradient-to-b from-[#4a7c59] to-[#355542]"
            >
              <span className="relative z-10">Submit order</span>
            </button>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-white/40 bg-white/60 px-6 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur-sm transition hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
