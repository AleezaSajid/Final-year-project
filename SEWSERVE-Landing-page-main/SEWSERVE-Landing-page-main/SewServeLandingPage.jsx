import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Ruler,
  MapPinned,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Scissors,
  UsersRound,
  HeartHandshake,
  Zap,
  BadgeCheck,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Truck,
} from "lucide-react";

import { SiFacebook, SiInstagram, SiPinterest, SiWhatsapp } from "react-icons/si";
import LandingNavbar from "./components/LandingNavbar.jsx";
import HowItWorksSplitSection from "./components/HowItWorksSplitSection.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "For Women", to: "/empower-her", navKey: "empower" },
  { label: "Track Orders", to: "/orders", navKey: "track" },
];

const heroTrustItems = [
  { label: "Perfect Fit Guaranteed", icon: Ruler },
  { label: "Premium Quality", icon: Leaf },
  { label: "On-time Delivery", icon: Truck },
];

/** Local hero assets in `public/images/` */
const HERO_IMG_TRADITIONAL_SHALWAR_KAMEEZ = `${process.env.PUBLIC_URL || ""}/images/traditional%20shalwar%20kameez.png`;
const HERO_IMG_WEDDING_DRESS = `${process.env.PUBLIC_URL || ""}/images/wedding%20dress%20image.png`;
const HERO_IMG_ATELIER_SHOWCASE = `${process.env.PUBLIC_URL || ""}/images/hero/WhatsApp%20Image%202026-05-05%20at%2012.11.37%20PM.jpeg`;
const HERO_IMG_WEDDING_MAXI = `${process.env.PUBLIC_URL || ""}/images/hero/maxi.png`;
const HERO_IMG_KIDS_OUT_DESIGN = `${process.env.PUBLIC_URL || ""}/images/hero/kids%20out%20design.png`;

/**
 * Hero slider — use local Pakistani / Muslim dress imagery.
 */
const HERO_CAROUSEL_SLIDES = [
  {
    id: "atelier",
    step: "Atelier showcase",
    title: "A studio that stitches both: formal + traditional",
    subtitle:
      "Measuring tapes on the form, clean finishing, and premium fabric choices—SewServe brings your tailor and your timeline into one place.",
    accentA: "rgba(245, 158, 11, 0.46)",
    accentB: "rgba(14, 165, 233, 0.18)",
    src: HERO_IMG_ATELIER_SHOWCASE,
    alt: "Formal and traditional outfits displayed for tailoring showcase",
    objectPosition: "50% 40%",
  },
  {
    id: "traditional",
    step: "Traditional shalwar kameez",
    title: "Classic embroidery, modest elegance",
    subtitle:
      "From neckline detailing to sleeve cuffs and trouser fall—SewServe helps you get traditional shalwar kameez stitched to your exact measurements.",
    accentA: "rgba(245, 158, 11, 0.52)", // amber/gold
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
    accentA: "rgba(220, 38, 38, 0.42)", // red
    accentB: "rgba(245, 158, 11, 0.24)", // gold
    src: HERO_IMG_WEDDING_DRESS,
    alt: "Wedding dress and groom outfit with rich embroidery and formal styling",
    objectPosition: "50% 25%",
  },
  {
    id: "kids",
    step: "Kids formal wear",
    title: "Mini looks, perfect tailoring",
    subtitle:
      "Festive kidswear stitched with comfort-first finishing—clean seams, soft linings, and the right fit for every celebration.",
    accentA: "rgba(245, 158, 11, 0.58)", // warm yellow wall
    accentB: "rgba(15, 23, 42, 0.26)", // deep navy outfit
    src: HERO_IMG_KIDS_OUT_DESIGN,
    alt: "Kids festive outfits in black and mustard tones",
    objectPosition: "70% 42%",
  },
  {
    id: "maxi",
    step: "Modern modest wedding",
    title: "Maxi & formal sets with modest coverage",
    subtitle:
      "Soft silhouettes, elegant embellishment, and modest styling—get the fit right from shoulders to hem with SewServe measurements and fittings.",
    accentA: "rgba(59, 130, 246, 0.40)",
    accentB: "rgba(245, 158, 11, 0.26)",
    src: HERO_IMG_WEDDING_MAXI,
    alt: "Modern modest maxi dress and formal suit styling",
    objectPosition: "50% 35%",
  },
];

const heroCarouselTextVariants = {
  enter: (dir) => ({
    x: dir > 0 ? 28 : -28,
    opacity: 0,
    filter: "none",
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "none",
    transition: {
      x: { type: "spring", stiffness: 320, damping: 28 },
      opacity: { duration: 0.35 },
      filter: { duration: 0 },
    },
  },
  exit: (dir) => ({
    x: dir < 0 ? 24 : -24,
    opacity: 0,
    filter: "none",
    transition: { duration: 0.25 },
  }),
};

function HeroImageCarousel() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [loaded, setLoaded] = useState(() => new Set());
  const n = HERO_CAROUSEL_SLIDES.length;

  const slide = HERO_CAROUSEL_SLIDES[index];
  const displaySlide = HERO_CAROUSEL_SLIDES[displayIndex];
  const glowVars = {
    "--ssGlowA": slide.accentA || "rgba(16, 185, 129, 0.45)",
    "--ssGlowB": slide.accentB || "rgba(14, 165, 233, 0.18)",
  };

  useEffect(() => {
    // Preload all hero images to avoid flash/blank during slide changes.
    HERO_CAROUSEL_SLIDES.forEach((s) => {
      if (!s?.src) return;
      const img = new Image();
      img.src = s.src;
    });
  }, []);

  useEffect(() => {
    const key = slide.src;
    if (!key) return;
    if (loaded.has(key)) {
      setDisplayIndex(index);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setLoaded((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setDisplayIndex(index);
    };
    img.src = key;
  }, [index, slide.src, loaded, slide]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % n);
    }, 7500);
    return () => window.clearInterval(id);
  }, [n]);

  const go = (delta) => {
    setDirection(delta > 0 ? 1 : -1);
    setIndex((i) => (i + delta + n) % n);
  };

  const prev = () => go(-1);
  const next = () => go(1);

  const navBtnClass =
    "z-[3] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/95 bg-white text-slate-500 shadow-[0_6px_20px_-4px_rgba(15,23,42,0.14)] transition-colors hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005C4B]/25 sm:h-10 sm:w-10";

  return (
    <div
      className="hero-slider-root relative mx-auto w-full max-w-2xl lg:max-w-none"
      style={glowVars}
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
      <div className="relative z-[2] flex w-full items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4">
        <motion.button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className={navBtnClass}
        >
          <ChevronLeft className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={2} aria-hidden />
        </motion.button>

        <motion.div
          className="hero-slider-shell min-w-0 flex-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-slider-viewport relative aspect-[4/3] w-full sm:aspect-[5/4]">
            <div key={`${displaySlide.id}-${displaySlide.src}`} className="absolute inset-0">
                <img
                  src={displaySlide.src}
                  alt={displaySlide.alt}
                  width={1200}
                  height={900}
                  className="hero-slider-img relative z-[1] h-full w-full object-cover"
                  style={{ objectPosition: displaySlide.objectPosition || "center" }}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
            </div>

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0f172a]/78 via-[#0f172a]/18 to-transparent sm:from-[#0f172a]/72 sm:via-[#0f172a]/12"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              aria-hidden
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 9px)",
              }}
            />

            <div className="absolute inset-x-0 bottom-0 z-[2] px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-16">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={`${slide.id}-${index}`}
                  custom={direction}
                  variants={heroCarouselTextVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="max-w-lg"
                >
                  <span className="mb-2 inline-flex items-center rounded-full border border-white/35 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50 sm:text-xs">
                    {slide.step}
                  </span>
                  <motion.h3
                    className="font-['Playfair_Display',Georgia,serif] text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.4)] sm:text-3xl"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06, duration: 0.4, ease: "easeOut" }}
                  >
                    {slide.title}
                  </motion.h3>
                  <motion.p
                    className="mt-2 text-sm font-medium leading-relaxed text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] sm:text-[0.9375rem]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.45, ease: "easeOut" }}
                  >
                    {slide.subtitle}
                  </motion.p>
                  <motion.span
                    className="mt-4 block h-0.5 max-w-[4.5rem] rounded-full bg-gradient-to-r from-emerald-300 to-teal-200"
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div
              className="absolute bottom-3 left-0 right-0 z-[4] flex justify-center gap-2 px-4 sm:bottom-4"
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
                  onClick={() => {
                    setDirection(i > index ? 1 : -1);
                    setIndex(i);
                  }}
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
                    animate={{
                      width: i === index ? 32 : 8,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.button
          type="button"
          onClick={next}
          aria-label="Next slide"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className={navBtnClass}
        >
          <ChevronRight className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={2} aria-hidden />
        </motion.button>
      </div>
    </div>
  );
}

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

function HeroWaveDivider() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] w-full leading-none text-white/50"
      aria-hidden="true"
    >
      <svg
        className="block h-[52px] w-full sm:h-[72px] md:h-[88px]"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="currentColor"
          d="M0,64L60,58.7C120,53,240,43,360,48C480,53,600,75,720,74.7C840,75,960,53,1080,42.7C1200,32,1320,32,1380,32L1440,32L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
        />
      </svg>
    </div>
  );
}

/** Marketing value props (moved from hero) — shown with icon tiles in Features */
const valueProps = [
  { label: "Custom Alterations", icon: Scissors },
  { label: "Expert Tailors", icon: UsersRound },
  { label: "Exceptional Service", icon: HeartHandshake },
  { label: "Fast", icon: Zap },
  { label: "Reliable", icon: BadgeCheck },
  { label: "Professional Tailoring Platform", icon: Briefcase },
];

const features = [
  {
    title: "Digital Measurements Wizard",
    bannerLabel: "Digital Measurement",
    description: "Easily enter your body measurements with a guided, beginner-friendly process.",
    icon: Ruler,
    route: "/features/measurement-wizard",
  },
  {
    title: "Real-Time Order Tracking",
    bannerLabel: "Order Tracking",
    description: "Stay updated from tailoring in progress to final delivery with live status updates.",
    icon: MapPinned,
    route: "/orders#order-tracking",
  },
  {
    title: "Trusted Local Tailors",
    bannerLabel: "Local Tailors",
    description: "Connect with verified professionals in your area for reliable, high-quality service.",
    icon: ShieldCheck,
    route: "/browse-tailors",
  },
];

const testimonials = [
  {
    name: "Ayesha Khan",
    feedback: "SewServe made tailoring so easy. My measurements were saved perfectly and the fit was exactly what I wanted.",
    avatar: "https://i.pravatar.cc/64?img=5",
  },
  {
    name: "Hina Malik",
    feedback: "I loved tracking my order in real time. The tailor updates kept me informed and confident throughout.",
    avatar: "https://i.pravatar.cc/64?img=32",
  },
  {
    name: "Sana Riaz",
    feedback: "The whole process felt smooth and professional. My stitched outfit arrived on time and looked amazing.",
    avatar: "https://i.pravatar.cc/64?img=47",
  },
];

const sectionReveal = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
};

const staggerFadeUp = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function SewServeLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);
  const [newsletterEmail, setNewsletterEmail] = useState("");

  useEffect(() => {
    document.title = "SewServe | Smart Tailoring Platform";
    const description = "SewServe helps you connect with trusted local tailors, submit measurements online, and track every order in real time.";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", description);

    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      document.head.appendChild(favicon);
    }
    favicon.setAttribute("href", "/favicon.ico");
  }, []);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = "auto"; };
  }, []);


  useEffect(() => {
    const sectionId = location.state?.scrollTo;
    if (!sectionId) return;
    const section = document.getElementById(sectionId);
    if (section) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: "smooth" });
      }, 0);
    }
  }, [location.state]);

  const handleSectionNavigate = (sectionId) => {
    if (location.pathname === "/") {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    navigate("/", { state: { scrollTo: sectionId } });
  };

  return (
    <div className="relative isolate min-h-screen bg-transparent text-slate-600 antialiased">
      <style>
        {`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700&display=swap');
.ss-nav-underline { position: relative; }
.ss-nav-underline::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -6px;
  height: 2px;
  width: 0;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3d6b4a, #4a7c59);
  transition: width 0.28s ease;
}
.ss-nav-underline:hover::after,
.ss-nav-underline:focus-visible::after { width: 100%; }

/* Full-viewport animated wash — sits at z-0 inside isolated root; never blocks pointer events */
.ss-page-bg-anim {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(ellipse 100% 80% at 10% 0%, rgba(167, 243, 208, 0.5), transparent 55%),
    radial-gradient(ellipse 90% 70% at 95% 15%, rgba(186, 230, 253, 0.52), transparent 52%),
    radial-gradient(ellipse 85% 60% at 50% 100%, rgba(216, 180, 254, 0.38), transparent 55%),
    radial-gradient(ellipse 60% 50% at 70% 55%, rgba(226, 232, 240, 0.45), transparent 50%),
    linear-gradient(180deg, #eef2f7 0%, #e2e8f0 35%, #f1f5f9 70%, #f8fafc 100%);
  background-size: 140% 140%;
  animation: ss-bg-gradient-drift 52s ease-in-out infinite alternate;
  filter: blur(28px) brightness(1.06);
}
/* Far depth — soft vignette for separation from mid layers */
.ss-page-bg-anim::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse 95% 90% at 50% 48%, transparent 42%, rgba(15, 23, 42, 0.065) 100%);
}

@keyframes ss-bg-gradient-drift {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 30% 100%; }
}

/* Apple-style frosted panels — sections / chrome (low fill, strong blur + saturation) */
.ss-glass-surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(15, 23, 42, 0.04);
}

/* Product cards — same backdrop layer as Measurement Wizard (soft fog, low contrast) */
.ss-glass-card {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(24px) saturate(165%);
  backdrop-filter: blur(24px) saturate(165%);
  box-shadow:
    0 2px 20px -4px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ss-glass-card:hover {
  border-color: rgba(255, 255, 255, 0.42);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.1) 100%);
}

/* Hero — mid depth: soft fog behind copy only (center column) */
.hero-mid-depth-fog {
  pointer-events: none;
  position: absolute;
  inset: -12% -8% -8%;
  z-index: 0;
  background: radial-gradient(circle at 50% 42%, rgba(74, 124, 89, 0.1), transparent 60%);
}

/* Hero — center spotlight (background layer only; no box/card) */
.hero-focal-spotlight {
  pointer-events: none;
  position: absolute;
  left: 50%;
  top: clamp(0.5rem, 12vw, 3.5rem);
  z-index: 1;
  width: min(130%, 32rem);
  height: min(46vh, 20rem);
  transform: translateX(-50%);
  background: radial-gradient(
    ellipse 68% 58% at 50% 36%,
    rgba(134, 239, 172, 0.11) 0%,
    rgba(147, 197, 253, 0.09) 38%,
    rgba(255, 255, 255, 0.03) 55%,
    transparent 72%
  );
  filter: blur(22px);
}

/* Hero — cinematic studio focus (H1 + CTA zone); sits above fog, below type */
.hero-cinematic-focus {
  pointer-events: none;
  position: absolute;
  left: 50%;
  top: clamp(5rem, 28vh, 12rem);
  z-index: 2;
  width: min(150%, 40rem);
  height: min(58vh, 26rem);
  transform: translate(-50%, -42%);
  background: radial-gradient(
    ellipse 58% 50% at 50% 48%,
    rgba(74, 124, 89, 0.18) 0%,
    rgba(59, 130, 246, 0.1) 42%,
    transparent 72%
  );
  filter: blur(72px);
  opacity: 0.88;
}

/* Hero — soft edge mask (shared); softer falloff to transparent ~90% */
.hero-img-mask-vision {
  mask-image: radial-gradient(
    ellipse 68% 82% at 50% 48%,
    #000 0%,
    #000 5%,
    rgba(0, 0, 0, 0.55) 38%,
    rgba(0, 0, 0, 0.18) 72%,
    transparent 90%
  );
  -webkit-mask-image: radial-gradient(
    ellipse 68% 82% at 50% 48%,
    #000 0%,
    #000 5%,
    rgba(0, 0, 0, 0.55) 38%,
    rgba(0, 0, 0, 0.18) 72%,
    transparent 90%
  );
  mask-mode: alpha;
}

/* Hero — float + contrast + cinematic ground shadow (applied to img) */
.hero-floating-img {
  transform-origin: 50% 60%;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.12);
  filter:
    contrast(1.08)
    drop-shadow(0 28px 56px rgba(15, 23, 42, 0.12))
    drop-shadow(0 42px 72px rgba(20, 90, 55, 0.08))
    drop-shadow(0 4px 2px rgba(255, 255, 255, 0.05));
}
.hero-floating-img--L {
  animation: hero-float-L 7s ease-in-out infinite;
}
.hero-floating-img--R {
  animation: hero-float-R 7s ease-in-out infinite;
}
@keyframes hero-float-L {
  0%, 100% { transform: translateY(-8px) scale(1.04); }
  50% { transform: translateY(0) scale(1.04); }
}
@keyframes hero-float-R {
  0%, 100% { transform: translateY(0) scale(1.04); }
  50% { transform: translateY(-8px) scale(1.04); }
}

/* Mannequin hero — curved ground shadow (bottom only, elliptical) */
.hero-mannequin-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.hero-mannequin-wrap .hero-floating-img {
  position: relative;
  z-index: 1;
}
.hero-mannequin-bottom-shadow {
  position: absolute;
  left: 50%;
  bottom: clamp(-10px, -2vw, -4px);
  z-index: 0;
  width: min(88%, 22rem);
  height: clamp(22px, 5vw, 40px);
  transform: translateX(-50%);
  pointer-events: none;
  border-radius: 50%;
  background: radial-gradient(
    ellipse 100% 100% at 50% 0%,
    rgba(15, 23, 42, 0.34) 0%,
    rgba(15, 23, 42, 0.16) 38%,
    rgba(15, 23, 42, 0.06) 58%,
    transparent 72%
  );
  filter: blur(12px);
  opacity: 0.95;
}

/* Hero — CTA: inner highlight + green glow + sweep (structure unchanged) */
.hero-cta {
  position: relative;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.32),
    inset 2px 3px 12px rgba(255, 255, 255, 0.12),
    0 6px 28px rgba(34, 110, 72, 0.38),
    0 2px 12px rgba(20, 70, 45, 0.22);
}
.hero-cta::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 90% 70% at 18% 12%, rgba(255, 255, 255, 0.35) 0%, transparent 52%),
    linear-gradient(175deg, rgba(255, 255, 255, 0.1) 0%, transparent 45%);
  pointer-events: none;
}
.hero-cta::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(
    105deg,
    transparent 0%,
    transparent 38%,
    rgba(255, 255, 255, 0.32) 50%,
    transparent 62%,
    transparent 100%
  );
  transform: translateX(-130%);
  transition: transform 0.75s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.hero-cta:hover::after {
  transform: translateX(130%);
}
.hero-cta > span {
  position: relative;
  z-index: 2;
}

/* Hero image slider — organic squircle, no outer white rim; shadow on viewport only */
.hero-slider-root {
  position: relative;
  z-index: 1;
}
.hero-slider-bloom {
  position: absolute;
  inset: -30% -18% -36% -18%;
  z-index: 0;
  pointer-events: none;
  border-radius: 42% 48% 44% 50% / 40% 44% 42% 48%;
  background: radial-gradient(
    ellipse 80% 76% at 42% 34%,
    var(--ssGlowA, rgba(134, 239, 172, 0.62)) 0%,
    rgba(110, 231, 183, 0.26) 28%,
    var(--ssGlowB, rgba(94, 234, 212, 0.18)) 52%,
    transparent 74%
  );
  filter: blur(78px) saturate(1.22);
  opacity: 1;
}
.hero-slider-bloom-2 {
  position: absolute;
  inset: -16% -10% -22% -10%;
  z-index: 0;
  pointer-events: none;
  border-radius: 46% 40% 48% 44% / 44% 46% 42% 48%;
  background: radial-gradient(
    ellipse 64% 58% at 58% 56%,
    rgba(255, 255, 255, 0.22) 0%,
    var(--ssGlowB, rgba(167, 243, 208, 0.22)) 42%,
    transparent 68%
  );
  filter: blur(54px) saturate(1.15);
}
.hero-slider-shell {
  position: relative;
  z-index: 2;
  background: transparent;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
}
.hero-slider-viewport {
  position: relative;
  overflow: hidden;
  background: #0f172a;
  border-radius: 2.5rem 3.75rem 2.25rem 3.35rem / 3rem 2.5rem 3.35rem 2.35rem;
  box-shadow:
    0 28px 56px -12px rgba(0, 92, 75, 0.12),
    0 48px 96px -24px rgba(15, 23, 42, 0.18),
    0 86px 170px -56px rgba(15, 23, 42, 0.16),
    0 44px 120px -34px var(--ssGlowA, rgba(52, 211, 153, 0.26)),
    0 30px 92px -30px var(--ssGlowB, rgba(14, 165, 233, 0.2)),
    0 10px 28px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.08);
}
.hero-slider-viewport::before {
  content: "";
  position: absolute;
  inset: -14%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 58% 46% at 22% 18%, var(--ssGlowA, rgba(52, 211, 153, 0.22)) 0%, transparent 62%),
    radial-gradient(ellipse 54% 46% at 86% 34%, var(--ssGlowB, rgba(14, 165, 233, 0.18)) 0%, transparent 64%);
  filter: blur(38px) saturate(1.18);
  opacity: 1;
}
.hero-slider-img {
  filter:
    drop-shadow(0 32px 78px rgba(15, 23, 42, 0.38))
    drop-shadow(0 46px 132px var(--ssGlowA, rgba(52, 211, 153, 0.28)))
    drop-shadow(0 32px 108px var(--ssGlowB, rgba(14, 165, 233, 0.22)));
}
@media (min-width: 640px) {
  .hero-slider-viewport {
    border-radius: 2.75rem 4rem 2.5rem 3.65rem / 3.35rem 2.75rem 3.65rem 2.6rem;
  }
}
`}
      </style>

      <div className="ss-page-bg-anim" aria-hidden="true" />

      <div className="relative z-10 min-h-screen pt-[60px] font-['Inter',sans-serif] sm:pt-[64px]">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
        />

        {/* Hero — two-column layout, stats bar, and carousel (matches SewServe landing mock) */}
        <div className="relative isolate overflow-hidden border-b border-emerald-100/40 bg-gradient-to-b from-white via-[#f7fdf9] to-[#ecfdf5]/35 backdrop-blur-sm">
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
          <div
            className="pointer-events-none absolute -left-28 top-1/4 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-teal-100/35 blur-3xl"
            aria-hidden
          />

          <section
            id="home"
            className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center px-4 pt-2 pb-0 sm:px-6 sm:pt-5 sm:pb-0 lg:min-h-[calc(100dvh-5rem)] lg:px-10 lg:pb-0"
          >
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
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
                  className="max-w-none whitespace-nowrap font-['Playfair_Display',Georgia,serif] text-[clamp(1.6rem,4.2vw,3rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#0f172a]"
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
                    onClick={() => navigate("/features/measurement-wizard")}
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
                    onClick={() => handleSectionNavigate("how-it-works")}
                    aria-label="Explore services"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#005C4B] bg-white px-6 py-3 text-base font-semibold text-[#005C4B] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#f0fdf4]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005C4B]/30 focus-visible:ring-offset-2"
                    whileHover={{ y: -3, scale: 1.02 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Scissors className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    Explore Services
                  </motion.button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.32, ease: "easeOut" }}
                  className="mt-7 flex w-full max-w-full flex-row flex-nowrap items-center justify-center gap-2 py-1 sm:gap-3 lg:justify-start lg:gap-4"
                >
                  {heroTrustItems.map(({ label, icon: Icon }) => (
                    <motion.div
                      key={label}
                      className="flex shrink-0 items-center gap-1.5 text-left text-[10px] font-semibold leading-snug text-slate-600 sm:gap-2 sm:text-[11px] md:text-xs"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d1fae5]/90 text-[#005C4B] shadow-inner shadow-white/50 ring-1 ring-[#005C4B]/10 sm:h-9 sm:w-9">
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="whitespace-nowrap">{label}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              <div className="order-1 w-full lg:order-2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
                >
                  <HeroImageCarousel />
                </motion.div>
              </div>
            </div>
          </section>

          <HeroWaveDivider />
        </div>

        {/* Features Section */}
        <motion.section
          id="about"
          className="ss-glass-surface relative z-[2] -mt-14 border-t border-white/30 py-[72px] shadow-[0_-16px_48px_-20px_rgba(15,23,42,0.1),0_24px_64px_-28px_rgba(15,23,42,0.1)] sm:-mt-[4.5rem] sm:py-20 md:-mt-20 md:py-[88px]"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-apple-h2 font-semibold tracking-tight text-ink">Features</h2>
              <p className="mt-2.5 text-base leading-[1.6] text-ink-muted">
                Everything you need to simplify tailoring, from measurement to final delivery.
              </p>
            </div>

            <motion.ul
              className="mt-10 grid grid-cols-2 gap-4 sm:mt-12 sm:grid-cols-3 lg:mt-14 lg:grid-cols-6 lg:gap-5"
              aria-label="Why choose SewServe"
              variants={staggerFadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
            >
              {valueProps.map(({ label, icon: ValueIcon }) => (
                <motion.li
                  key={label}
                  className="ss-glass-card flex flex-col items-center gap-3 rounded-2xl px-3 py-4 text-center shadow-md shadow-slate-900/[0.04] sm:px-4 sm:py-5"
                  variants={fadeUpItem}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/80 text-emerald-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-200/50"
                    aria-hidden
                  >
                    <ValueIcon className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <span className="text-xs font-semibold leading-snug tracking-tight text-ink sm:text-[0.8125rem]">
                    {label}
                  </span>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              className="mt-12 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:mt-16 lg:grid-cols-3 lg:gap-8"
              variants={staggerFadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {features.map((feature) => {
                const Icon = feature.icon;
                const bannerClassName =
                  "shrink-0 rounded-2xl bg-gradient-to-br from-emerald-50/95 via-white/75 to-emerald-100/55 text-emerald-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.88),0_1px_2px_rgba(16,185,129,0.1),0_4px_14px_-3px_rgba(5,80,60,0.1)] ring-1 ring-inset ring-emerald-200/45 transition-all duration-500 ease-out group-hover:scale-[1.03] group-hover:bg-gradient-to-br group-hover:from-emerald-50 group-hover:via-emerald-50/90 group-hover:to-emerald-100/65 group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_2px_6px_rgba(16,185,129,0.14),0_8px_20px_-6px_rgba(5,80,60,0.12)] group-hover:ring-emerald-300/55 group-hover:brightness-[1.02]";

                return (
                  <motion.article
                    key={feature.title}
                    className="ss-glass-card group flex h-full cursor-pointer flex-col rounded-apple-card p-5 shadow-lg shadow-slate-900/5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/[0.08] sm:p-6"
                    onClick={() => navigate(feature.route)}
                    variants={fadeUpItem}
                    whileHover={{ y: -6, scale: 1.015 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className={`flex w-full min-w-0 items-center gap-2.5 p-3 ${bannerClassName}`}>
                      <Icon
                        className="h-6 w-6 shrink-0 drop-shadow-[0_1px_1px_rgba(5,80,60,0.15)]"
                        aria-hidden
                      />
                      <h3 className="m-0 min-w-0 flex-1 text-left text-apple-h3 font-semibold leading-snug tracking-tight text-ink">
                        {feature.bannerLabel}
                      </h3>
                    </div>
                    <p className="mt-2.5 flex-1 text-base leading-[1.6] text-ink-muted">{feature.description}</p>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        <HowItWorksSplitSection />

        {/* Testimonials Section */}
        <motion.section
          id="testimonials"
          className="ss-glass-surface relative z-[1] border-t border-white/25 py-[72px] shadow-[0_20px_56px_-24px_rgba(15,23,42,0.1)] sm:py-20 md:py-[88px]"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-apple-h2 font-semibold tracking-tight text-ink">Testimonials</h2>
              <p className="mt-2.5 text-base leading-[1.6] text-ink-muted">
                Hear what our customers say about their SewServe tailoring experience.
              </p>
            </div>

            <motion.div
              className="mt-10 grid gap-6 md:grid-cols-3"
              variants={staggerFadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {testimonials.map((testimonial) => (
                <motion.article
                  key={testimonial.name}
                  className="ss-glass-card rounded-apple-card p-5 shadow-lg shadow-slate-900/5 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 sm:p-6"
                  variants={fadeUpItem}
                  whileHover={{ y: -6, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={testimonial.avatar}
                      alt={`${testimonial.name} avatar`}
                      loading="lazy"
                      width="48"
                      height="48"
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-100"
                    />
                    <h3 className="text-base font-semibold tracking-tight text-ink">{testimonial.name}</h3>
                  </div>
                  <p className="mt-2.5 text-base leading-[1.6] text-ink-muted">{testimonial.feedback}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Footer */}
        <footer
          id="contact"
          className="ss-glass-surface relative z-[1] overflow-hidden border-t border-white/30 py-14 shadow-[0_-12px_40px_-16px_rgba(15,23,42,0.08)] sm:py-16 md:py-[4.5rem]"
        >
          {/* Subtle top emerald glow (premium accent) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent blur-[0.5px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-0 h-10 w-[min(100%,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/[0.12] blur-2xl"
            aria-hidden
          />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 text-left lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-slate-200/40">
              {/* Column 1 — Brand & socials */}
              <div className="flex flex-col gap-5 lg:pr-8">
                <a
                  href="#home"
                  className="inline-flex w-fit shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600/30"
                  aria-label="SewServe — home"
                >
                  <img
                    src={logoDisplaySrc}
                    alt=""
                    width={180}
                    height={44}
                    className="block h-9 max-h-[44px] w-auto object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition-[filter,transform] duration-[250ms] ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                  />
                </a>
                <p className="text-sm text-slate-600">Expert Tailoring for Your Perfect Fit</p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    <SiFacebook className="h-5 w-5" />
                  </a>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    <SiInstagram className="h-5 w-5" />
                  </a>
                  <a
                    href="https://wa.me/1234567890"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="WhatsApp"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    <SiWhatsapp className="h-5 w-5" />
                  </a>
                  <a
                    href="https://pinterest.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Pinterest"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E60023] text-white shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    <SiPinterest className="h-5 w-5" />
                  </a>
                </div>
                <div className="border-t border-slate-200/50 pt-5">
                  <p className="text-xs text-slate-600">© 2026 SewServe. All rights reserved.</p>
                  <div className="mt-3 flex flex-col gap-2 text-xs text-slate-600">
                    <a
                      href="#"
                      className="w-fit transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                    >
                      Privacy Policy
                    </a>
                    <a
                      href="#"
                      className="w-fit transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                    >
                      Terms &amp; Conditions
                    </a>
                  </div>
                </div>
              </div>

              {/* Column 2 — Quick Links */}
              <div className="lg:px-8">
                <h3 className="text-sm font-bold text-slate-800">Quick Links</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  {[
                    { label: "Home", href: "#home" },
                    { label: "About Us", href: "#about" },
                    { label: "Services", href: "#how-it-works" },
                    { label: "FAQs", href: "#testimonials" },
                    { label: "Contact Us", href: "#contact" },
                  ].map((item) => (
                    <li key={item.label} className="flex gap-2">
                      <span className="text-slate-400" aria-hidden>
                        •
                      </span>
                      <a
                        href={item.href}
                        className="transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 3 — Our Services */}
              <div className="lg:px-8">
                <h3 className="text-sm font-bold text-slate-800">Our Services</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  {["Custom Tailoring", "Alterations", "Wedding Attire", "Bespoke Suits"].map((label) => (
                    <li key={label} className="flex gap-2">
                      <span className="text-slate-400" aria-hidden>
                        •
                      </span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 4 — Get in touch & newsletter */}
              <div className="lg:pl-8">
                <h3 className="text-sm font-bold text-slate-800">Get in Touch</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  <li className="flex gap-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <a
                      href="mailto:info@sewserve.com"
                      className="transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                    >
                      info@sewserve.com
                    </a>
                  </li>
                  <li className="flex gap-2.5">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <span>Call Us: +1 234 567 8900</span>
                  </li>
                  <li className="flex gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <span>Visit Us: 123 Tailor St, Suite 100, New York, NY 10001</span>
                  </li>
                </ul>
                <div className="mt-8 border-t border-slate-200/50 pt-6">
                  <p className="text-sm font-bold text-slate-800">Subscribe to Our Newsletter</p>
                  <form
                    className="mt-3 flex overflow-hidden rounded-lg border border-slate-200/60 bg-white/90 shadow-sm"
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <label htmlFor="footer-newsletter-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="footer-newsletter-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/35"
                    />
                    <button
                      type="submit"
                      className="shrink-0 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50"
                    >
                      Subscribe
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}