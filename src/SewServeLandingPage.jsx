import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";

import { SiFacebook, SiInstagram, SiPinterest, SiWhatsapp } from "react-icons/si";
import LandingNavbar from "./components/LandingNavbar.jsx";
import HowItWorksSplitSection from "./components/HowItWorksSplitSection.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

/** Hero imagery — local assets from /public/images/hero/ */
const HERO_IMAGE_SEWING = `${process.env.PUBLIC_URL || ""}/images/hero/sewingmachine.png`;
const HERO_IMAGE_MANNEQUIN = `${process.env.PUBLIC_URL || ""}/images/hero/mannequin.png`;
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
`}
      </style>

      <div className="ss-page-bg-anim" aria-hidden="true" />

      <div className="relative z-10 min-h-screen font-['Inter',sans-serif]">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
        />

        {/* Hero: full-bleed background + wave; content max-width centered */}
        <div className="relative isolate overflow-hidden border-b border-white/25 bg-white/[0.06] backdrop-blur-xl">
          {/* Mid-depth ambient blobs — studio tint behind hero columns */}
          <div
            className="pointer-events-none absolute -left-36 top-[12%] h-[min(26rem,88vw)] w-[min(26rem,88vw)] rounded-full bg-emerald-400/12 blur-[2.75rem]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-36 top-[12%] h-[min(26rem,88vw)] w-[min(26rem,88vw)] rounded-full bg-sky-400/13 blur-[2.75rem]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-[22%] left-1/3 h-56 w-56 rounded-full bg-violet-200/12 blur-3xl"
            aria-hidden="true"
          />

          <section
            id="home"
            className="relative z-10 mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-7xl flex-col justify-center px-4 pt-12 pb-24 sm:px-6 sm:pt-16 sm:pb-28 md:min-h-[calc(100dvh-6rem)] md:pb-32 lg:min-h-[calc(100dvh-5rem)] lg:px-10 lg:pb-40"
          >
            <div className="grid items-center gap-14 lg:grid-cols-3 lg:gap-12 xl:gap-14">
              {/* Left image — leads sequence; strong boom, then copy animates in */}
              <div className="relative z-[4] order-2 flex min-h-0 w-full min-w-0 origin-center scale-[0.96] items-center justify-center self-center py-3 sm:py-4 md:py-5 lg:order-none lg:min-h-0 lg:scale-100 lg:self-stretch lg:py-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.75, y: 80 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  whileHover={{ scale: 1.03, transition: { duration: 0.25, ease: "easeOut" } }}
                  className="origin-center will-change-transform"
                >
                  <img
                    src={HERO_IMAGE_SEWING}
                    alt="Vintage sewing machine and tailoring tools"
                    width={720}
                    height={900}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="hero-floating-img hero-floating-img--L hero-img-mask-vision mx-auto h-[192px] w-[168px] shrink-0 select-none object-cover object-center opacity-[0.88] sm:h-[208px] sm:w-[184px] md:h-[228px] md:w-[208px] lg:h-[min(420px,52vh)] lg:w-full lg:max-w-[min(100%,28rem)] lg:opacity-100"
                  />
                </motion.div>
              </div>

              <div className="relative z-[6] order-1 mx-auto flex min-w-0 w-full max-w-lg flex-col items-center text-center lg:order-none">
                <div className="hero-mid-depth-fog" aria-hidden="true" />
                <div className="hero-focal-spotlight" aria-hidden="true" />
                <div className="hero-cinematic-focus" aria-hidden="true" />
                <div className="relative z-[12] flex w-full justify-center px-3">
                  <motion.h1
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
                    className="inline-block max-w-none text-center font-['Playfair_Display',Georgia,serif] text-[clamp(1.25rem,4.25vw,2.5rem)] font-bold leading-[1.2] tracking-[-0.02em] whitespace-nowrap drop-shadow-[0_2px_3px_rgba(0,0,0,0.07)]"
                  >
                    <span className="bg-gradient-to-b from-[#070b14] to-[#1e293b] bg-clip-text text-transparent">
                      Crafted for the Perfect Fit
                    </span>
                  </motion.h1>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.52, ease: "easeOut" }}
                  className="relative z-[12] mx-auto mt-8 max-w-lg text-base font-normal leading-[1.6] tracking-[0.01em] text-ink-muted sm:text-[1rem]"
                >
                  From measurement to delivery, experience a seamless tailoring journey designed around you.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1.0, ease: "easeOut" }}
                  className="relative z-[12] mt-11 flex justify-center"
                >
                  <button
                    type="button"
                    onClick={() => navigate("/features/measurement-wizard")}
                    aria-label="Book a fitting — open measurement wizard"
                    className="hero-cta rounded-apple bg-gradient-to-b from-[#4a7c59] to-[#355542] px-[18px] py-2.5 text-base font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-1 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2"
                  >
                    <span className="relative z-10">Book a Fitting</span>
                  </button>
                </motion.div>
              </div>

              <div className="relative z-[4] order-3 flex min-h-0 w-full min-w-0 origin-center scale-[0.96] items-center justify-center self-center py-3 sm:py-4 md:py-5 lg:order-none lg:min-h-0 lg:scale-100 lg:self-stretch lg:py-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.75, y: 80 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  whileHover={{ scale: 1.03, transition: { duration: 0.25, ease: "easeOut" } }}
                  className="hero-mannequin-wrap hero-floating-img--R mx-auto origin-center will-change-transform"
                >
                  <img
                    src={HERO_IMAGE_MANNEQUIN}
                    alt="Tailored suit on a dress form with measuring tape"
                    width={720}
                    height={900}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="hero-floating-img hero-img-mask-vision mx-auto h-[192px] w-[168px] shrink-0 select-none object-cover object-center opacity-[0.88] sm:h-[208px] sm:w-[184px] md:h-[228px] md:w-[208px] lg:h-[min(420px,52vh)] lg:w-full lg:max-w-[min(100%,28rem)] lg:opacity-100"
                  />
                  <span className="hero-mannequin-bottom-shadow" aria-hidden />
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

            <ul
              className="mt-10 grid grid-cols-2 gap-4 sm:mt-12 sm:grid-cols-3 lg:mt-14 lg:grid-cols-6 lg:gap-5"
              aria-label="Why choose SewServe"
            >
              {valueProps.map(({ label, icon: ValueIcon }) => (
                <li
                  key={label}
                  className="ss-glass-card flex flex-col items-center gap-3 rounded-2xl px-3 py-4 text-center shadow-md shadow-slate-900/[0.04] sm:px-4 sm:py-5"
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
                </li>
              ))}
            </ul>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:mt-16 lg:grid-cols-3 lg:gap-8">
              {features.map((feature) => {
                const Icon = feature.icon;
                const bannerClassName =
                  "shrink-0 rounded-2xl bg-gradient-to-br from-emerald-50/95 via-white/75 to-emerald-100/55 text-emerald-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.88),0_1px_2px_rgba(16,185,129,0.1),0_4px_14px_-3px_rgba(5,80,60,0.1)] ring-1 ring-inset ring-emerald-200/45 transition-all duration-500 ease-out group-hover:scale-[1.03] group-hover:bg-gradient-to-br group-hover:from-emerald-50 group-hover:via-emerald-50/90 group-hover:to-emerald-100/65 group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_2px_6px_rgba(16,185,129,0.14),0_8px_20px_-6px_rgba(5,80,60,0.12)] group-hover:ring-emerald-300/55 group-hover:brightness-[1.02]";

                return (
                  <article
                    key={feature.title}
                    className="ss-glass-card group flex h-full cursor-pointer flex-col rounded-apple-card p-5 shadow-lg shadow-slate-900/5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/[0.08] sm:p-6"
                    onClick={() => navigate(feature.route)}
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
                  </article>
                );
              })}
            </div>
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

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <article key={testimonial.name} className="ss-glass-card rounded-apple-card p-5 shadow-lg shadow-slate-900/5 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 sm:p-6">
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
                </article>
              ))}
            </div>
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