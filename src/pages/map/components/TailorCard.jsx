import { MapPin, Star } from "lucide-react";

function avatarUrl(imgId) {
  return `https://i.pravatar.cc/128?img=${imgId}`;
}

/**
 * Rich tailor row for the dashboard list (matches booking platform card pattern).
 */
export default function TailorCard({
  tailor,
  selected,
  onSelect,
  onViewAccept,
  primaryActionLabel = "View & Accept",
  primaryDisabled = false,
  hidePrimaryAction = false,
}) {
  const priceLabel = `Rs. ${tailor.priceMin.toLocaleString()} - ${tailor.priceMax.toLocaleString()}`;

  return (
    <article
      className={`ss-glass-card rounded-apple-card p-4 shadow-md transition sm:p-5 ${
        selected
          ? "border-emerald-300/80 ring-2 ring-emerald-500/35 shadow-emerald-900/10"
          : "hover:border-white/50 hover:shadow-lg"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => onSelect(tailor)}
          className="flex min-w-0 flex-1 gap-4 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45"
        >
          <img
            src={avatarUrl(tailor.avatarImg)}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-white/80"
            width={64}
            height={64}
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-ink">{tailor.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                {tailor.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                {tailor.distanceLabel} away
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              <span className="font-medium text-ink-body">Specializes in:</span> {tailor.specialty}
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-800">{priceLabel}</p>
          </div>
        </button>
        {hidePrimaryAction ? (
          <p className="shrink-0 self-center text-center text-xs text-ink-muted sm:self-start sm:pt-1 sm:text-right">
            Est. delivery: {tailor.deliveryDays}
          </p>
        ) : (
          <div className="flex shrink-0 flex-col gap-2 sm:w-40 sm:items-end">
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={() => onViewAccept(tailor)}
              className="hero-cta w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 sm:w-auto bg-gradient-to-b from-[#4a7c59] to-[#355542]"
            >
              <span className="relative z-10">{primaryActionLabel}</span>
            </button>
            <p className="text-center text-xs text-ink-muted sm:text-right">Est. delivery: {tailor.deliveryDays}</p>
          </div>
        )}
      </div>
    </article>
  );
}
