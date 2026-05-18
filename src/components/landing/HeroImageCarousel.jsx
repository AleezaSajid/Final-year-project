import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PUB = process.env.PUBLIC_URL || "";

const HERO_IMG_TRADITIONAL_SHALWAR_KAMEEZ = `${PUB}/images/traditional%20shalwar%20kameez.png`;
const HERO_IMG_WEDDING_DRESS = `${PUB}/images/wedding%20dress%20image.png`;
const HERO_IMG_LADY_FORMAL = `${PUB}/lady2.png`;
const HERO_IMG_LADY_ELEGANT = `${PUB}/lady3.png`;

const HERO_CAROUSEL_SLIDES = [
  {
    id: "traditional",
    step: "Traditional shalwar kameez",
    title: "Classic embroidery, modest elegance",
    subtitle:
      "From neckline detailing to sleeve cuffs and trouser fall—SewServe helps you get traditional shalwar kameez stitched to your exact measurements.",
    accentA: "rgba(245, 158, 11, 0.52)",
    accentB: "rgba(234, 179, 8, 0.22)",
    src: HERO_IMG_TRADITIONAL_SHALWAR_KAMEEZ,
    alt: "Traditional shalwar kameez outfit with elegant embroidery",
    objectPosition: "50% 35%",
  },
  {
    id: "wedding",
    step: "Wedding & festive",
    title: "Wedding looks that shine in every photo",
    subtitle:
      "Bridal and groom styling, premium finishing, and timeline-friendly fittings—SewServe keeps your tailor and your progress in sync before the big day.",
    accentA: "rgba(220, 38, 38, 0.42)",
    accentB: "rgba(245, 158, 11, 0.24)",
    src: HERO_IMG_WEDDING_DRESS,
    alt: "Wedding dress and groom outfit with rich embroidery and formal styling",
    objectPosition: "50% 25%",
  },
  {
    id: "formal",
    step: "Formal & evening",
    title: "Tailored silhouettes for every occasion",
    subtitle:
      "Premium fabric choices, clean finishing, and a fit that moves with you—book measurements and track progress in one place.",
    accentA: "rgba(59, 130, 246, 0.4)",
    accentB: "rgba(16, 185, 129, 0.22)",
    src: HERO_IMG_LADY_FORMAL,
    alt: "Elegant formal tailoring showcase",
    objectPosition: "50% 30%",
  },
  {
    id: "celebration",
    step: "Celebration wear",
    title: "Festive looks with a perfect fit",
    subtitle:
      "From first fitting to final delivery, stay connected with your tailor and your timeline on SewServe.",
    accentA: "rgba(167, 243, 208, 0.48)",
    accentB: "rgba(14, 165, 233, 0.2)",
    src: HERO_IMG_LADY_ELEGANT,
    alt: "Celebration outfit with refined tailoring",
    objectPosition: "50% 38%",
  },
];

const navBtnClass =
  "z-[3] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/95 bg-white text-slate-500 shadow-[0_6px_20px_-4px_rgba(15,23,42,0.14)] transition-colors hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005C4B]/25 sm:h-10 sm:w-10";

function preloadSlideImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === "function") {
          await img.decode();
        }
      } catch {
        // decode can fail on some browsers; image is still usable
      }
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export default function HeroImageCarousel() {
  const [index, setIndex] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  const n = HERO_CAROUSEL_SLIDES.length;

  const slide = HERO_CAROUSEL_SLIDES[index];
  const glowVars = {
    "--ssGlowA": slide.accentA || "rgba(16, 185, 129, 0.45)",
    "--ssGlowB": slide.accentB || "rgba(14, 165, 233, 0.18)",
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all(HERO_CAROUSEL_SLIDES.map((s) => preloadSlideImage(s.src)));
      if (!cancelled) {
        setImagesReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!imagesReady) return undefined;

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, 7500);

    return () => window.clearInterval(id);
  }, [imagesReady, n]);

  const go = useCallback(
    (delta) => {
      setIndex((i) => (i + delta + n) % n);
    },
    [n]
  );

  return (
    <motion.div
      className="hero-slider-root relative mx-auto w-full max-w-2xl lg:max-w-none"
      style={glowVars}
      initial={{ opacity: 0, scale: 0.96, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
    >
      <motion.div
        className="hero-slider-bloom"
        aria-hidden
        animate={{ opacity: [0.9, 1, 0.9], scale: [1, 1.12, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="hero-slider-bloom-2"
        aria-hidden
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.06, 1] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
      />
      <motion.div
        className="hero-slider-bloom-3"
        aria-hidden
        animate={{ opacity: [0.7, 0.95, 0.7], scale: [1, 1.08, 1] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />

      <motion.div className="relative z-[2] flex w-full items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4">
        <motion.button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous slide"
          disabled={!imagesReady}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className={navBtnClass}
        >
          <ChevronLeft className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={2} aria-hidden />
        </motion.button>

        <motion.div className="hero-slider-shell min-w-0 flex-1">
          <div className="hero-slider-viewport relative aspect-[4/3] w-full overflow-hidden sm:aspect-[5/4]">
            <motion.div
              className="hero-slider-base absolute inset-0 z-0"
              aria-hidden
              initial={false}
              animate={{ opacity: imagesReady ? 0 : 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />

            <div className="hero-slider-media-stack absolute inset-0 z-[1] overflow-hidden">
              {HERO_CAROUSEL_SLIDES.map((s, i) => {
                const isActive = i === index;
                return (
                  <img
                    key={s.id}
                    src={s.src}
                    alt={isActive ? s.alt : ""}
                    width={1200}
                    height={900}
                    aria-hidden={!isActive}
                    decoding="async"
                    fetchPriority={i === 0 ? "high" : "low"}
                    className={`hero-slider-img-layer hero-slider-img absolute inset-0 h-full w-full object-cover ${
                      isActive ? "hero-slider-img-layer--active" : "hero-slider-img-layer--idle"
                    }`}
                    style={{ objectPosition: s.objectPosition || "center" }}
                  />
                );
              })}
            </div>

            {!imagesReady && (
              <div
                className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"
                aria-hidden
              >
                <motion.div className="h-8 w-8 animate-pulse rounded-full border-2 border-emerald-400/30 border-t-emerald-300/80" />
              </div>
            )}

            {imagesReady && (
              <motion.div
                className="hero-slider-chrome absolute inset-0 z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div
                  className="hero-slider-caption-scrim pointer-events-none absolute inset-x-0 bottom-0 z-[1]"
                  aria-hidden
                />

                <div className="hero-slider-copy pointer-events-none absolute inset-x-0 bottom-0 z-[2] px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-16">
                  <div className="max-w-lg">
                    <span className="mb-2 inline-flex items-center rounded-full border border-white/35 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50 sm:text-xs">
                      {slide.step}
                    </span>
                    <h3 className="font-['Playfair_Display',Georgia,serif] text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.4)] sm:text-3xl">
                      {slide.title}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] sm:text-[0.9375rem]">
                      {slide.subtitle}
                    </p>
                    <span
                      className="mt-4 block h-0.5 max-w-[4.5rem] rounded-full bg-gradient-to-r from-emerald-300 to-teal-200"
                      aria-hidden
                    />
                  </div>
                </div>

                <div
                  className="pointer-events-auto absolute bottom-3 left-0 right-0 z-[3] flex justify-center gap-2 px-4 sm:bottom-4"
                  role="tablist"
                  aria-label="Tailoring journey slides"
                >
                  {HERO_CAROUSEL_SLIDES.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      aria-label={`${s.step}: ${s.title}`}
                      onClick={() => setIndex(i)}
                      className="group relative flex h-2.5 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <motion.span
                        layout
                        className={`block h-2 rounded-full ${
                          i === index
                            ? "bg-[#005C4B] shadow-[0_2px_10px_rgba(0,92,75,0.45)]"
                            : "bg-slate-300/95 shadow-sm group-hover:bg-slate-200"
                        }`}
                        initial={false}
                        animate={{ width: i === index ? 32 : 8 }}
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.button
          type="button"
          onClick={() => go(1)}
          aria-label="Next slide"
          disabled={!imagesReady}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className={navBtnClass}
        >
          <ChevronRight className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={2} aria-hidden />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
