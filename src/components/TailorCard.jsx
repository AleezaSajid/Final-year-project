import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MapPin, Scissors, Star } from "lucide-react";
import { getApiBaseUrl } from "../api/client.js";

function resolveImageSrc(raw) {
  const src = typeof raw === "string" ? raw.trim() : "";
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) {
    const base = getApiBaseUrl();
    return base ? `${base}${src}` : src;
  }
  return src;
}

function tailorInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "SS";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Compact premium horizontal tailor card (UI only).
 */
export default function TailorCard({ tailor, onViewProfile, onSendRequest }) {
  const [imgFailed, setImgFailed] = useState(false);
  const {
    imageUrl,
    name,
    specialty,
    rating,
    experienceYears,
    distanceKm,
    availability,
    priceLabel,
    id,
  } = tailor;

  const resolvedImageUrl = resolveImageSrc(imageUrl);
  const showPlaceholder = !resolvedImageUrl || imgFailed;
  const initials = useMemo(() => tailorInitials(name), [name]);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedImageUrl]);

  const isAvailable = availability === "available";
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const ordersCompleted = 40 + (Number(id) || 0) * 47 + (experienceYears || 0) * 12;
  const priceDisplay = priceLabel.replace(/^Starting from\s*/i, "From ");

  return (
    <article className="browse-tailor-card group flex w-full flex-row overflow-hidden rounded-2xl border border-white/55 bg-gradient-to-r from-white/92 via-white/78 to-emerald-50/20 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.16)] ring-1 ring-white/70 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_rgba(15,118,110,0.22)]">
      <div className="relative h-[8.75rem] w-[7.5rem] max-w-[120px] shrink-0 overflow-hidden rounded-l-2xl sm:h-[8.75rem] sm:w-[120px]">
        {!showPlaceholder ? (
          <img
            src={resolvedImageUrl}
            alt={name}
            className="h-full w-full max-h-[140px] object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-100/95 via-teal-50/90 to-sky-100/80 text-emerald-900/50"
            aria-hidden
          >
            <span className="grid h-9 w-9 place-content-center rounded-xl bg-white/60 text-emerald-800 shadow-inner ring-1 ring-white/80">
              <Scissors className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-sm font-bold tracking-tight">{initials}</span>
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-900/30 to-transparent"
          aria-hidden
        />
        <div className="absolute left-1.5 top-1.5 z-[1] flex max-w-[calc(100%-0.5rem)] flex-col gap-1">
          <span
            className={`w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none shadow-sm ${
              isAvailable ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
            }`}
          >
            {isAvailable ? "Available" : "Busy"}
          </span>
          <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/35 bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
            <MapPin className="h-2.5 w-2.5 shrink-0 text-emerald-600" aria-hidden />
            {distanceKm} km
          </span>
        </div>
      </div>

      <div className="flex min-h-[8.75rem] min-w-0 flex-1 flex-col justify-between gap-2 py-2.5 pl-3 pr-3 sm:py-3 sm:pl-3.5 sm:pr-3.5">
        <div className="min-w-0 space-y-1.5">
          <h3 className="truncate text-[0.95rem] font-bold leading-tight text-[#0f172a] sm:text-base">{name}</h3>
          {specialty ? (
            <span className="inline-flex max-w-full truncate rounded-full border border-emerald-200/60 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 sm:text-[11px]">
              {specialty}
            </span>
          ) : null}

          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium text-slate-600 sm:text-[11px]"
            aria-label={`Rating ${rating} out of 5`}
          >
            <span className="inline-flex items-center gap-0.5">
              <span className="flex items-center">
                {[0, 1, 2, 3, 4].map((i) => {
                  const filled = i < fullStars || (i === fullStars && hasHalf);
                  return (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${
                        filled ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
                      }`}
                      strokeWidth={filled ? 0 : 1.5}
                      aria-hidden
                    />
                  );
                })}
              </span>
              <span className="font-bold tabular-nums text-[#0f172a]">{Number(rating).toFixed(1)}</span>
            </span>
            <span className="text-slate-400" aria-hidden>
              ·
            </span>
            <span className="font-semibold text-slate-700">{ordersCompleted.toLocaleString()}+ orders</span>
            <span className="text-slate-400" aria-hidden>
              ·
            </span>
            <span>{experienceYears} yrs</span>
          </div>

          <p className="truncate text-[11px] font-bold text-emerald-900 sm:text-xs">{priceDisplay}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            onClick={onViewProfile}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-b from-[#0d5c4b] to-[#064e3b] px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(6,78,59,0.55)] transition-all duration-300 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 active:scale-[0.98] sm:px-4 sm:text-xs"
          >
            View Profile
            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onSendRequest}
            className="text-[10px] font-semibold text-emerald-800 underline decoration-emerald-700/35 underline-offset-2 transition-colors hover:text-emerald-950 sm:text-[11px]"
          >
            Send Request
          </button>
        </div>
      </div>
    </article>
  );
}
