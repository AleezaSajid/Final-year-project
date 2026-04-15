import React, { useCallback, useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleHelp, Home, X } from "lucide-react";
import { SewServeBrandImg } from "./SewServeBrandImg.jsx";

const INSTRUCTIONS = [
  "Use a soft measuring tape",
  "Keep body straight while measuring",
  "Do not pull tape too tight",
  "Ask someone for assistance if possible",
];

const FAQ_ITEMS = [
  {
    q: "How do I measure chest size?",
    a: "Wrap the tape around the fullest part of your chest, under the arms and across the shoulder blades. Keep the tape level and breathe normally.",
  },
  {
    q: "How do I measure waist correctly?",
    a: "Find your natural waist (usually the narrowest point above the belly button). Wrap the tape snugly but not tight— you should be able to slip one finger under it.",
  },
  {
    q: "What if my measurements are incorrect?",
    a: "Re-measure in good lighting, stand naturally, and compare with a previous garment that fits. You can update values in this wizard before submitting.",
  },
];

/**
 * Minimal navbar for measurement wizard / onboarding only.
 */
export default function WizardNavbar() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const titleId = useId();

  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeHelp();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [helpOpen, closeHelp]);

  return (
    <header className="ss-wizard-navbar sticky top-0 z-50 font-['Inter',system-ui,sans-serif]">
      <style>
        {`
          .ss-wizard-navbar {
            border-bottom: 1px solid rgba(255, 255, 255, 0.35);
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            backdrop-filter: blur(28px) saturate(180%);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.35),
              0 1px 2px rgba(15, 23, 42, 0.04),
              0 8px 32px -8px rgba(15, 23, 42, 0.08);
          }
        `}
      </style>

      <nav className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/35 focus-visible:ring-offset-2"
          aria-label="Go to SewServe home"
        >
          <SewServeBrandImg
            decorative
            className="h-9 max-h-9 w-auto max-w-[min(200px,52vw)] object-contain drop-shadow-[0_2px_8px_rgba(20,44,77,0.12)]"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <motion.button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/50 bg-white/35 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/55 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30 sm:px-4"
            aria-label="Go to home"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Home className="h-4 w-4 text-[#2f5a42]" strokeWidth={2} aria-hidden />
            <span>Home</span>
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a5240]/15 bg-gradient-to-b from-[#3d6b4a]/90 to-[#2f5a42]/95 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/40 focus-visible:ring-offset-2 sm:px-4"
            aria-expanded={helpOpen}
            aria-haspopup="dialog"
            aria-controls="wizard-help-dialog"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <CircleHelp className="h-4 w-4 opacity-95" strokeWidth={2} aria-hidden />
            <span>Help</span>
          </motion.button>
        </div>
      </nav>

      <AnimatePresence>
        {helpOpen ? (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center px-4 pb-6 pt-[min(10vh,4.5rem)] sm:px-6 sm:pt-[min(12vh,5.5rem)]"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
              aria-label="Close help"
              onClick={closeHelp}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              id="wizard-help-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-[101] w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-b from-white/90 to-white/82 shadow-[0_24px_80px_-20px_rgba(15,23,42,0.28)] backdrop-blur-sm sm:max-w-lg"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-2.5 sm:px-5 sm:py-3">
                <h2
                  id={titleId}
                  className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg"
                >
                  Measurement Help
                </h2>
                <button
                  type="button"
                  onClick={closeHelp}
                  className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-600 transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/35"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              <div className="max-h-[min(72vh,28rem)] overflow-y-auto px-4 py-3 sm:px-5 sm:py-3.5">
                <div className="flex flex-col space-y-3 sm:space-y-4">
                  <section>
                    <h3 className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-900">
                      Instructions
                    </h3>
                    <ul className="space-y-1.5 text-sm leading-snug text-slate-700">
                      {INSTRUCTIONS.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#3d6b4a]" aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-900">
                      FAQ
                    </h3>
                    <div className="space-y-2">
                      {FAQ_ITEMS.map(({ q, a }) => (
                        <div
                          key={q}
                          className="rounded-lg border border-slate-200/60 bg-white/80 px-3 py-2.5 shadow-sm transition-colors hover:bg-white/95 sm:px-3.5"
                        >
                          <p className="text-sm font-semibold leading-snug text-slate-900">{q}</p>
                          <p className="mt-1 text-sm leading-snug text-slate-700">{a}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
