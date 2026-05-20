import React from "react";
import { motion } from "framer-motion";
import { Calendar, Scissors } from "lucide-react";
import HeroImageCarousel from "./HeroImageCarousel.jsx";
import "./landingHeroStyles.css";

export default function LandingHeroSection({
  heroHighlights,
  goToMeasurementWizard,
  onExploreTailors,
}) {
  return (
    <div className="landing-hero-root relative isolate border-b border-white/25 bg-transparent">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <span className="absolute left-[10%] top-[18%] h-1.5 w-1.5 rounded-full bg-[#005C4B]/20" />
        <span className="absolute right-[20%] top-[28%] h-1 w-1 rounded-full bg-[#005C4B]/15" />
        <span className="absolute bottom-[40%] left-[15%] text-[10px] text-[#005C4B]/25">✦</span>
        <span className="absolute right-[12%] top-[40%] text-xs text-[#005C4B]/20">✦</span>
        <span className="absolute right-[14%] top-[16%] text-[11px] text-[#005C4B]/22">✦</span>
        <div
          className="absolute right-[6%] top-[12%] h-28 w-36 opacity-[0.4] sm:h-36 sm:w-44"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0, 92, 75, 0.16) 1.2px, transparent 1.2px)",
            backgroundSize: "11px 11px",
          }}
        />
      </div>

      <section
        id="home"
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center px-4 pt-2 pb-6 sm:px-6 sm:pt-5 sm:pb-8 lg:px-10 lg:pt-6 lg:pb-10"
      >
        <motion.div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
          <div className="order-2 flex min-w-0 flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#005C4B]/12 bg-[#d1fae5]/80 px-4 py-1.5 text-sm font-medium text-[#005C4B] shadow-sm shadow-emerald-900/5"
            >
              <Scissors className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Custom Tailoring Made Easy
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
              className="max-w-none font-['Playfair_Display',Georgia,serif] text-[clamp(1.75rem,4.2vw,3rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#0f172a] sm:whitespace-nowrap"
            >
              Crafted for the Perfect Fit
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
              className="mt-4 max-w-lg text-base leading-relaxed text-slate-600 sm:text-[1.05rem]"
            >
              From measurement to delivery, experience a seamless tailoring journey designed around you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
              className="mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start"
            >
              <motion.button
                type="button"
                onClick={goToMeasurementWizard}
                aria-label="Book a fitting — open measurement wizard"
                className="hero-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#005C4B] to-[#004038] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#005C4B]/25 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005C4B]/40 focus-visible:ring-offset-2"
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  Book a Fitting
                </span>
              </motion.button>
              <motion.button
                type="button"
                onClick={onExploreTailors}
                aria-label="Explore tailors near you"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#005C4B] bg-white px-6 py-3 text-base font-semibold text-[#005C4B] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#f0fdf4]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005C4B]/30 focus-visible:ring-offset-2"
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
              >
                <Scissors className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                Explore Tailors
              </motion.button>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.32, ease: "easeOut" }}
              className="mt-7 mb-1 flex w-full max-w-full flex-row flex-nowrap items-stretch justify-center gap-2 sm:gap-2.5 lg:justify-start"
              aria-label="SewServe highlights"
            >
              {heroHighlights.map(({ title, icon: HighlightIcon }) => (
                <motion.li
                  key={title}
                  className="ss-hero-glass-card ss-hero-glass-card--compact flex min-h-0 min-w-0 flex-1 items-center gap-1.5"
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span
                    className="ss-hero-card-icon inline-flex items-center justify-center bg-gradient-to-br from-[#d1fae5] to-[#a7f3d0] text-[#005C4B] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-[#005C4B]/10"
                    aria-hidden
                  >
                    <HighlightIcon strokeWidth={2} />
                  </span>
                  <p className="min-w-0 text-left text-[10px] font-bold leading-tight tracking-tight text-slate-700 sm:text-[11px]">
                    {title}
                  </p>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            className="order-1 w-full lg:order-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
          >
            <HeroImageCarousel />
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
