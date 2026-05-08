import { Check, MapPin, Sparkles } from "lucide-react";

/**
 * Marketing-style hero for the map dashboard page (SewServe glass + emerald theme).
 */
export default function MapHeroSection({ geoStatus, onDetectLocation }) {
  const locationOn = geoStatus === "ok";

  return (
    <section className="ss-glass-card relative overflow-hidden rounded-apple-card p-5 shadow-lg shadow-slate-900/5 sm:p-6 lg:p-7">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-300/12 blur-[2.5rem]" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/16 blur-[2.5rem]" aria-hidden />

      <div className="relative z-[1] grid items-center gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-200/60">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Smart matching
          </p>
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Get Your Dress Stitched by a{" "}
            <span className="bg-gradient-to-b from-[#355542] to-[#4a7c59] bg-clip-text text-transparent">
              Nearby Professional Tailor
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-[1.6] text-ink-muted">
            After you complete the measurement wizard, your order appears here. See nearby tailors and live updates as
            they respond.
          </p>
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={onDetectLocation}
              className="hero-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 bg-gradient-to-b from-[#4a7c59] to-[#355542]"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden />
                Detect My Location
              </span>
            </button>
            <p className="flex w-full min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-ink-muted sm:w-auto sm:max-w-md">
              {locationOn ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  Location access: On
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                  {geoStatus === "pending" ? "Detecting location…" : "Using default area or enable location"}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          <div className="ss-glass-card rounded-2xl p-6 shadow-lg shadow-slate-900/5">
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="relative flex h-32 w-full max-w-[280px] items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-px w-full max-w-[200px] border-t-2 border-dashed border-emerald-200/90" />
                </div>
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a7c59] to-[#355542] text-white shadow-lg shadow-emerald-900/25">
                  <MapPin className="h-8 w-8" aria-hidden />
                </div>
                <span className="absolute left-4 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-white/90">
                  <span className="text-lg">👩‍🦰</span>
                </span>
                <span className="absolute right-4 top-8 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 ring-4 ring-white/90">
                  <span className="text-lg">👩🏽</span>
                </span>
                <span className="absolute bottom-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-white/90">
                  <span className="text-lg">👩🏻</span>
                </span>
              </div>
              <p className="text-center text-sm leading-relaxed text-ink-muted">
                We notify nearby tailors about your order so the nearest one can accept and start working on it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
