import { Clock3, Heart, MapPin, Star, Tag } from "lucide-react";
import { getApiBaseUrl } from "../../../api/client.js";

function avatarUrl(imgId) {
  return `https://i.pravatar.cc/128?img=${imgId}`;
}

const DEFAULT_PROFILE_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1f5f9"/>
      <stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="96" height="96" rx="22" fill="url(#g)"/>
  <circle cx="48" cy="40" r="16" fill="#94a3b8"/>
  <path d="M20 86c4-16 18-24 28-24s24 8 28 24" fill="#94a3b8"/>
</svg>
`);

function resolveTailorImageSrc(tailor) {
  const raw = tailor?.imageUrl || tailor?.avatarImg || "";
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
  if (!tailor) return null;

  const priceMin = tailor.priceMin ?? null;
  const priceMax = tailor.priceMax ?? null;
  const priceStart = tailor.priceStart ?? null;
  const safeStart = Number.isFinite(Number(priceStart)) ? Number(priceStart) : null;
  const safeMin = Number.isFinite(Number(priceMin)) ? Number(priceMin) : null;
  const safeMax = Number.isFinite(Number(priceMax)) ? Number(priceMax) : null;

  const priceLabel = (() => {
    // Prefer explicit min/max range when it is truly a range.
    if (safeMin != null && safeMax != null && safeMax > safeMin) {
      return `Rs. ${safeMin.toLocaleString()} - ${safeMax.toLocaleString()}`;
    }
    // If only one value is known, show single value (avoid fake ranges).
    const single = safeMin ?? safeMax ?? safeStart;
    if (single == null) return "";
    return `Rs. ${single.toLocaleString()}`;
  })();

  const rating = Number(tailor.rating);
  const ratingLabel = Number.isFinite(rating) ? rating.toFixed(1) : "—";
  const distanceLabel = typeof tailor.distanceLabel === "string" ? tailor.distanceLabel : "";
  const specialty = typeof tailor.specialty === "string" ? tailor.specialty : "";
  const deliveryDays = tailor.deliveryDays ?? "";
  const avatarSeed = tailor.avatarImg ?? tailor.id ?? 1;
  const displayName = tailor.shopName || tailor.name || "Tailor";
  const imageSrc = resolveTailorImageSrc(tailor) || DEFAULT_PROFILE_PLACEHOLDER;
  const showRange = safeMin != null && safeMax != null && safeMax > safeMin;

  return (
    <article
      className={`rounded-3xl border bg-white/80 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-md transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out sm:p-5 ${
        selected
          ? "border-emerald-400/60 bg-emerald-50/30 scale-[1.02] shadow-md shadow-slate-900/10"
          : "border-slate-200/70 hover:bg-white/90 hover:shadow-sm hover:shadow-slate-900/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelect(tailor)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35"
        >
          <img
            src={imageSrc}
            alt=""
            className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200/60"
            width={48}
            height={48}
            loading="lazy"
            onError={(e) => {
              if (e?.currentTarget?.src !== DEFAULT_PROFILE_PLACEHOLDER) {
                e.currentTarget.src = DEFAULT_PROFILE_PLACEHOLDER;
              }
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{tailor.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                {ratingLabel}
              </span>
              {distanceLabel ? (
                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  {distanceLabel} away
                </span>
              ) : null}
            </div>
          </div>
        </button>

        <button
          type="button"
          className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Save tailor"
        >
          <Heart className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {specialty ? (
        <div className="mt-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/60">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/70">
              <Tag className="h-3 w-3" aria-hidden />
            </span>
            Specializes in: {specialty}
          </span>
        </div>
      ) : null}

      {!hidePrimaryAction ? (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/70">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">From</p>
            <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-slate-900">
              {priceLabel ? (showRange ? priceLabel.replace("Rs. ", "") : priceLabel.replace("Rs. ", "")) : "—"}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="inline-flex items-center justify-end gap-2 text-xs font-semibold text-slate-600">
              <Clock3 className="h-4 w-4 text-slate-500" aria-hidden />
              Est. delivery
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {deliveryDays ? `${deliveryDays} days` : "—"}
            </p>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  tailor.availability === "busy" ? "bg-rose-500" : "bg-emerald-500"
                }`}
                aria-hidden
              />
              {tailor.availability === "busy" ? "Busy" : "Available"}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {priceLabel ? (showRange ? "" : "") : ""}
            </span>
          </div>
        </div>
      ) : null}

      {!hidePrimaryAction ? (
        <button
          type="button"
          disabled={primaryDisabled}
          onClick={() => onViewAccept(tailor)}
          className="mt-4 w-full rounded-2xl bg-gradient-to-b from-[#2f855a] to-[#1f6a45] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:brightness-105 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
        >
          {primaryActionLabel} →
        </button>
      ) : (
        <p className="mt-4 text-center text-xs font-medium text-slate-600">Est. delivery: {deliveryDays}</p>
      )}
    </article>
  );
}
