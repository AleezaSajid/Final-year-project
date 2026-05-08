import { useEffect, useState } from "react";
import { ChevronRight, MapPin, Star } from "lucide-react";
import { getApiBaseUrl } from "../api/client.js";

const FALLBACK_IMG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#e2e8f0" width="400" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="14">Photo</text></svg>`
  );

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

/**
 * Marketplace-style tailor listing card (UI only).
 * Horizontal layout: ~40% image, ~1.8:1 card aspect (landscape), glass panel.
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

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedImageUrl]);

  const isAvailable = availability === "available";
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const ordersCompleted = 40 + (Number(id) || 0) * 47 + (experienceYears || 0) * 12;
  const reviewCount = 88000 + (Number(id) || 0) * 15420 + Math.floor(rating * 8200);

  return (
    <article className="group flex aspect-[37/20] w-full flex-row overflow-hidden rounded-3xl border border-white/30 bg-white/20 shadow-md ring-1 ring-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/25 hover:shadow-lg sm:p-4">
      <div className="relative w-[40%] shrink-0 self-stretch p-2 sm:p-0 sm:pr-0">
        <div className="relative h-full min-h-[7.5rem] overflow-hidden rounded-2xl bg-gray-100 sm:min-h-0 sm:rounded-xl">
          <img
            src={imgFailed ? FALLBACK_IMG : resolvedImageUrl}
            alt={name}
            className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent"
            aria-hidden
          />
          <div className="absolute left-1.5 top-1.5 z-[1] flex max-w-[calc(100%-0.75rem)] flex-col gap-1 sm:left-2 sm:top-2">
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm sm:text-xs ${
                isAvailable ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
              }`}
            >
              {isAvailable ? "Available" : "Busy"}
            </span>
            <span className="flex w-fit items-center gap-0.5 rounded-full border border-white/35 bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-gray-800 shadow-sm backdrop-blur-sm sm:gap-1 sm:px-2 sm:text-xs">
              <MapPin className="h-2.5 w-2.5 shrink-0 text-emerald-600 sm:h-3 sm:w-3" aria-hidden />
              {distanceKm} km
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-2 py-2 pr-2 pl-1 sm:gap-3 sm:py-1 sm:pr-1 sm:pl-3">
        <div className="min-w-0 space-y-1 sm:space-y-1.5">
          <h3 className="truncate text-base font-bold leading-tight text-emerald-950 sm:text-lg">{name}</h3>
          <p className="line-clamp-2 text-xs font-medium text-emerald-900/70 sm:text-sm">{specialty}</p>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" aria-label={`Rating ${rating} out of 5`}>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => {
                const filled = i < fullStars || (i === fullStars && hasHalf);
                return (
                  <Star
                    key={i}
                    className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                      filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"
                    }`}
                    strokeWidth={filled ? 0 : 1.5}
                    aria-hidden
                  />
                );
              })}
            </div>
            <span className="text-xs font-bold tabular-nums text-emerald-950 sm:text-sm">
              {reviewCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-800/60 sm:text-xs">· {experienceYears} yrs</span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] sm:gap-x-3 sm:text-xs">
            <div>
              <p className="font-medium text-emerald-800/65">Orders completed</p>
              <p className="font-bold tabular-nums text-emerald-950">{ordersCompleted.toLocaleString()}+</p>
            </div>
            <div>
              <p className="font-medium text-emerald-800/65">Starting price</p>
              <p className="truncate font-bold text-emerald-950">
                {priceLabel.replace(/^Starting from\s*/i, "")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onViewProfile}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.03] hover:bg-emerald-900 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:px-5 sm:text-sm"
          >
            View Profile
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onSendRequest}
            className="text-[10px] font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-2 transition-all duration-300 hover:text-emerald-950 sm:text-xs"
          >
            Send Request
          </button>
        </div>
      </div>
    </article>
  );
}
