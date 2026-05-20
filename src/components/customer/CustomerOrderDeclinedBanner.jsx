import { X } from "lucide-react";

/**
 * Premium rose glass banner when a tailor declines a customer request.
 */
export default function CustomerOrderDeclinedBanner({
  notice,
  onDismiss,
  onFindAnotherTailor,
  onChooseAnotherTailor,
  className = "",
  titleId = "customer-decline-title",
}) {
  if (!notice) return null;

  const tailorLabel =
    notice.tailorName && String(notice.tailorName).trim() && notice.tailorName !== "the tailor"
      ? String(notice.tailorName).trim()
      : "This tailor";
  const onChoose = onChooseAnotherTailor || onFindAnotherTailor;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50/95 via-white/90 to-rose-50/80 px-4 py-4 text-rose-950 shadow-lg shadow-rose-900/8 backdrop-blur-md sm:px-5 sm:py-5 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-rose-300/20 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p id={titleId} className="text-sm font-semibold leading-snug sm:text-base">
            {tailorLabel} is not available for this request.
          </p>
          {notice.reason ? (
            <p className="mt-1.5 text-sm leading-relaxed text-rose-900/90">
              Reason: {notice.reason}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {onChoose ? (
              <button
                type="button"
                onClick={onChoose}
                className="rounded-xl border border-rose-200/80 bg-white/95 px-4 py-2 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/45"
              >
                Choose another tailor
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-rose-800/90 transition hover:bg-rose-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/45"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-rose-700/80 transition hover:bg-rose-100/80 hover:text-rose-900"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
