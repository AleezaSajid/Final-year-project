import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, FileText, PackageCheck, Shirt, UserPlus } from "lucide-react";

const sectionReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const panelTransition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] };

/** @type {{ id: string; title: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; description: string; features: string[] }[]} */
const HOW_IT_WORKS_ITEMS = [
  {
    id: "register",
    title: "Private onboarding",
    Icon: UserPlus,
    description:
      "One refined profile becomes the anchor for every commission—preferences, history, and context your tailor can read at a glance. No clutter, no duplicate forms.",
    features: [
      "A single source of truth for you and your atelier",
      "Preferences that follow every garment you commission",
      "Enterprise-grade sign-in with verification built in",
    ],
  },
  {
    id: "measurements",
    title: "Fit calibration",
    Icon: FileText,
    description:
      "Translate your silhouette into data your tailor trusts—through a guided flow that respects craft, not jargon. Save, revisit, and refine until the numbers feel right.",
    features: [
      "Guided capture that reads like a conversation, not a form",
      "Autosave and revision history so nothing is lost in transit",
      "Measurements your tailor can execute without second-guessing",
    ],
  },
  {
    id: "track",
    title: "Live order clarity",
    Icon: PackageCheck,
    description:
      "See the story of each piece as it moves through the atelier—milestones, timing, and context in one composed view. Alignment without the back-and-forth.",
    features: [
      "Milestone visibility from bench work to dispatch",
      "Delivery windows that update as the garment evolves",
      "Garment-level context so nothing is ambiguous",
    ],
  },
  {
    id: "receive",
    title: "The final reveal",
    Icon: Shirt,
    description:
      "Your finished work arrives with the same intention that built it—inspected, finished, and ready for the moment you first try it on. Pickup or delivery, on your terms.",
    features: [
      "Handoff options that respect your schedule",
      "Quality pass before the garment ever leaves the atelier",
      "A clear path if a refinement is still on the table",
    ],
  },
];

function StepPill({ item, stepIndex, isActive, onSelect }) {
  const { Icon, title, id } = item;
  const stepLabel = String(stepIndex + 1).padStart(2, "0");

  return (
    <motion.button
      id={`how-tab-${id}`}
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(id)}
      layout
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3.5 py-2.5 text-left transition-[transform,box-shadow] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80 ${
        isActive
          ? "scale-105 bg-gradient-to-b from-[#4a7c59] to-[#355542] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_36px_-10px_rgba(34,110,72,0.45),0_4px_14px_-4px_rgba(15,23,42,0.12)] ring-1 ring-white/15"
          : "ss-glass-card shadow-md shadow-slate-900/[0.04] hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-900/[0.08]"
      }`}
    >
      {/* Active: left glowing indicator */}
      {isActive ? (
        <span
          className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-white shadow-[0_0_14px_4px_rgba(255,255,255,0.85),0_0_24px_6px_rgba(187,247,208,0.5)]"
          aria-hidden
        />
      ) : null}

      <span
        className={`relative z-[1] shrink-0 rounded-lg p-2 ${
          isActive
            ? "bg-white/20 text-white ring-1 ring-white/25"
            : "bg-gradient-to-br from-emerald-50 to-emerald-100/80 text-emerald-700 ring-1 ring-emerald-200/50"
        }`}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>

      <span
        className={`relative z-[1] min-w-0 flex-1 text-sm font-semibold tracking-tight ${
          isActive ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </span>

      <span
        className={`relative z-[1] shrink-0 tabular-nums text-[11px] font-bold tracking-wide ${
          isActive ? "text-white/80" : "text-emerald-800/50"
        }`}
        aria-hidden
      >
        {stepLabel}
      </span>
    </motion.button>
  );
}

/**
 * Premium “How it works”: matches landing `ss-glass-surface` sections; compact pills + glass panel.
 */
export default function HowItWorksSplitSection() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(() => HOW_IT_WORKS_ITEMS[0].id);
  const active =
    HOW_IT_WORKS_ITEMS.find((x) => x.id === activeId) ?? HOW_IT_WORKS_ITEMS[0];

  return (
    <motion.section
      id="how-it-works"
      className="ss-glass-surface relative z-[1] border-t border-white/25 py-[72px] shadow-[0_20px_56px_-24px_rgba(15,23,42,0.1)] sm:py-20 md:py-[88px]"
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              HOW IT WORKS
            </p>

            <h2 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              Tailoring, orchestrated end to end
            </h2>

            <p className="mx-auto mb-3 max-w-xl text-[15px] leading-relaxed text-gray-600 md:text-base">
              Four deliberate movements—from intake to handoff—so every commission feels composed, transparent, and unmistakably yours. Select a step to preview the experience.
            </p>

            <p className="mx-auto max-w-lg text-sm leading-relaxed text-gray-500">
              Built for clients who expect precision—and ateliers who refuse to compromise on craft.
            </p>
          </div>
        </header>

        <div className="mt-12 grid items-start gap-10 md:mt-14 md:grid-cols-[minmax(0,280px)_1fr] md:gap-12 lg:gap-14">
          {/* Steps rail */}
          <aside
            className="ss-glass-card rounded-2xl p-4 shadow-md shadow-slate-900/[0.04] sm:p-5"
            aria-label="Process steps"
          >
            <p className="px-0.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Overview
            </p>
            <div className="flex flex-col gap-2" role="tablist" aria-label="SewServe journey — select a step">
              {HOW_IT_WORKS_ITEMS.map((item, index) => (
                <StepPill
                  key={item.id}
                  item={item}
                  stepIndex={index}
                  isActive={activeId === item.id}
                  onSelect={setActiveId}
                />
              ))}
            </div>
          </aside>

          {/* Glass content panel */}
          <div className="relative min-h-[260px] md:min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                role="tabpanel"
                aria-labelledby={`how-tab-${active.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={panelTransition}
                className="ss-glass-card relative h-full overflow-hidden rounded-2xl p-8 shadow-lg shadow-slate-900/5 sm:p-10"
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-90"
                  style={{
                    background:
                      "radial-gradient(circle at 18% 0%, rgba(74, 124, 89, 0.07), transparent 45%)",
                  }}
                  aria-hidden
                />

                <div className="relative">
                  <h3 className="text-3xl font-semibold tracking-tight text-ink">{active.title}</h3>
                  <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-muted">{active.description}</p>

                  <ul className="mt-8 space-y-3.5">
                    {active.features.map((line) => (
                      <li key={line} className="flex items-start gap-3.5">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/90 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-200/55">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                        </span>
                        <span className="pt-0.5 text-[15px] font-medium leading-snug text-ink">{line}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10 border-t border-slate-200/60 pt-8 sm:mt-12">
                    <button
                      type="button"
                      onClick={() => navigate("/features/measurement-wizard")}
                      className="hero-cta rounded-apple bg-gradient-to-b from-[#4a7c59] to-[#355542] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2"
                    >
                      <span className="relative z-10">Open Measurement Experience</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
