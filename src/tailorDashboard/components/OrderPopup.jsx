import { motion } from "framer-motion";

/**
 * Fixed top-center overlay for map-style “new order nearby” alerts (tailor dashboard).
 * Does not alter underlying dashboard layout — renders as a sibling overlay.
 */
/** Mirrors map “Order details” (`MapPlaceOrderForm`); shown when customer submits on the map. */
export default function OrderPopup({ order, onInterested, onIgnore }) {
  if (!order) return null;

  const garment =
    order.dressType != null && String(order.dressType).trim() !== "" ? String(order.dressType).trim() : "—";
  const dueDisplay =
    order.dueDate != null && String(order.dueDate).trim() !== "" ? String(order.dueDate).trim() : "—";
  const notesDisplay =
    order.notes != null && String(order.notes).trim() !== "" ? String(order.notes).trim() : "—";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-popup-title"
      aria-describedby="order-popup-question"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 20, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="pointer-events-auto fixed left-1/2 top-0 z-[10050] w-[min(100%-1.5rem,24rem)] -translate-x-1/2 px-3 sm:w-[min(100%-2rem,26rem)]"
    >
      <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="order-popup-title" className="text-lg font-semibold tracking-tight text-slate-900">
              New order from map
            </h2>
            <p id="order-popup-question" className="mt-2 text-sm font-medium leading-snug text-slate-700">
              Do you want to accept this order?
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Order details</p>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 font-medium text-slate-500">Garment / order type</dt>
            <dd className="text-right font-semibold text-slate-900">{garment}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 font-medium text-slate-500">Preferred due date</dt>
            <dd className="text-right font-semibold text-slate-900">{dueDisplay}</dd>
          </div>
          <div className="flex justify-between gap-4 align-top">
            <dt className="shrink-0 font-medium text-slate-500">Notes (optional)</dt>
            <dd className="max-w-[60%] text-right font-semibold text-slate-900">{notesDisplay}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onIgnore}
            className="order-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:order-1"
          >
            No, thanks
          </button>
          <button
            type="button"
            onClick={onInterested}
            className="hero-cta order-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 sm:order-2 bg-gradient-to-b from-[#4a7c59] to-[#355542]"
          >
            <span className="relative z-10">Accept order</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
