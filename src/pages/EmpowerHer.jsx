import { motion } from "framer-motion";
import { ArrowRight, Clock3, Home, Scissors, TrendingUp, UserPlus } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LandingNavbar from "../components/LandingNavbar";
import { LandingStylePageBackground } from "../components/LandingStylePageBackground.jsx";
import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "about" },
  { label: "Contact", sectionId: "contact" },
];

const featureCards = [
  {
    title: "Work from Home",
    description: "No travel, no stress. Work comfortably from your own home.",
    icon: Home,
    color: "from-pink-400 to-fuchsia-400",
  },
  {
    title: "Earn Independently",
    description: "Turn your tailoring skills into a steady and respectful income.",
    icon: TrendingUp,
    color: "from-violet-500 to-purple-500",
  },
  {
    title: "Flexible Hours",
    description: "Choose your own schedule and accept orders when it suits you.",
    icon: Clock3,
    color: "from-amber-400 to-orange-400",
  },
  {
    title: "Grow with Us",
    description: "Receive more orders and keep improving your craft and business.",
    icon: Scissors,
    color: "from-cyan-400 to-teal-400",
  },
];

const stats = [
  { value: "1000+", label: "Women Empowered" },
  { value: "5000+", label: "Orders Completed" },
  { value: "100%", label: "Growth & Support" },
];

/** For Women (EmpowerHer) — hero + story + CTA portraits (`public/pakistani lady.png`) */
const EMPOWER_PORTRAIT_SRC = `${process.env.PUBLIC_URL || ""}/${encodeURI("pakistani lady.png")}`;

export default function EmpowerHer() {
  const navigate = useNavigate();
  const heroImage = EMPOWER_PORTRAIT_SRC;
  const storyImage = EMPOWER_PORTRAIT_SRC;
  const logoSrc = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;
  const logoDisplaySrc = useSewServeLogoProcessedSrc(logoSrc);

  const handleSectionNavigate = useCallback((sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const goToTailorSignup = useCallback(() => {
    navigate("/tailor-signup");
  }, [navigate]);

  return (
    <div className="emp-page relative isolate min-h-screen bg-transparent text-slate-900">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap');

          .emp-page {
            font-family: 'Inter', system-ui, sans-serif;
            overflow-x: hidden;
            color: #0f172a;
          }

          .emp-page h1,
          .emp-page h2,
          .emp-page h3 {
            font-family: 'Poppins', system-ui, sans-serif;
            font-weight: 600;
            letter-spacing: -0.02em;
          }

          .emp-page p,
          .emp-page li {
            font-family: 'Inter', system-ui, sans-serif;
            font-weight: 500;
            font-size: 1rem;
          }

          .emp-page button {
            font-family: 'Poppins', system-ui, sans-serif;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: none;
            letter-spacing: 0.01em;
          }

          .emp-label {
            font-family: 'Poppins', system-ui, sans-serif;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: none;
            letter-spacing: normal;
          }

          .emp-section-kicker {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: #0f766e;
            margin-bottom: 0.5rem;
          }

          .emp-cta-panel .emp-section-kicker {
            color: rgba(204, 251, 241, 0.92);
          }

          .emp-section-title {
            font-family: 'Cormorant Garamond', 'Georgia', serif;
            font-weight: 600;
            letter-spacing: -0.03em;
            line-height: 1.08;
          }

          .emp-hero-shell {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 252, 0.88) 100%);
          }

          .emp-hero-section {
            position: relative;
            z-index: 10;
            background: transparent;
          }

          .emp-hero-left {
            position: relative;
            z-index: 2;
            background: transparent;
          }

          .emp-hero-content {
            padding: 0.85rem 2.75rem 2.25rem;
          }

          .emp-script {
            font-family: 'Poppins', system-ui, sans-serif;
            font-size: clamp(2rem, 4vw, 3.15rem);
            line-height: 1.05;
            font-style: normal;
            font-weight: 800;
            background: linear-gradient(120deg, #0f766e 0%, #0d9488 45%, #115e59 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            letter-spacing: -0.02em;
            display: inline-flex;
            align-items: center;
            gap: 0.55rem;
          }

          .emp-script-heart {
            color: #14b8a6;
            font-size: 0.92em;
            filter: drop-shadow(0 2px 8px rgba(20, 184, 166, 0.35));
          }

          .emp-title {
            font-family: 'Cormorant Garamond', 'Georgia', serif;
            margin-top: 0.75rem;
            font-size: clamp(2.5rem, 5vw, 3.75rem);
            line-height: 1.02;
            letter-spacing: -0.03em;
            font-weight: 700;
            color: #0f172a;
          }

          .emp-title-main {
            display: block;
            white-space: nowrap;
          }

          .emp-title-accent {
            font-family: 'Cormorant Garamond', 'Georgia', serif;
            display: block;
            margin-top: 0.15rem;
            font-size: 0.92em;
            font-weight: 600;
            line-height: inherit;
            font-style: italic;
            background: linear-gradient(100deg, #5b21b6 0%, #7c3aed 40%, #0d9488 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }

          .emp-body {
            margin-top: 1.15rem;
            font-size: 1.05rem;
            line-height: 1.72;
            color: #475569;
            max-width: 36rem;
          }

          .emp-point-list {
            margin-top: 1.25rem;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 1.4rem;
            row-gap: 0.7rem;
            font-size: 1.03rem;
            font-weight: 700;
            color: #1f2937;
          }

          .emp-point-item {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            color: #1e293b;
          }

          .emp-cta-row {
            margin-top: 1.4rem;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 1rem;
          }

          .emp-glass-card {
            border: 1px solid rgba(255, 255, 255, 0.55);
            background: linear-gradient(165deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 50%, rgba(248, 250, 252, 0.45) 100%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            backdrop-filter: blur(28px) saturate(180%);
            box-shadow:
              0 4px 24px -6px rgba(15, 23, 42, 0.08),
              0 24px 48px -32px rgba(15, 23, 42, 0.12),
              0 0 0 1px rgba(15, 118, 110, 0.06),
              inset 0 1px 0 rgba(255, 255, 255, 0.75);
            transition:
              transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.4s ease,
              border-color 0.3s ease,
              filter 0.4s ease;
            animation: emp-card-glow-idle 7s ease-in-out infinite;
          }

          @keyframes emp-card-glow-idle {
            0%, 100% {
              box-shadow:
                0 4px 24px -6px rgba(15, 23, 42, 0.08),
                0 24px 48px -32px rgba(15, 23, 42, 0.12),
                0 0 32px -10px rgba(27, 77, 62, 0.16),
                0 0 22px -8px rgba(15, 118, 110, 0.12),
                inset 0 1px 0 rgba(255, 255, 255, 0.75);
            }
            50% {
              box-shadow:
                0 8px 32px -6px rgba(15, 23, 42, 0.12),
                0 32px 64px -28px rgba(15, 23, 42, 0.16),
                0 0 52px -8px rgba(15, 118, 110, 0.26),
                0 0 36px -6px rgba(27, 77, 62, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.82);
            }
          }

          .emp-glass-card:hover {
            border-color: rgba(20, 184, 166, 0.45);
            background: linear-gradient(165deg, rgba(255, 255, 255, 0.95) 0%, rgba(236, 253, 245, 0.62) 100%);
            box-shadow:
              0 18px 48px -10px rgba(15, 23, 42, 0.16),
              0 40px 80px -32px rgba(13, 148, 136, 0.32),
              0 0 56px -6px rgba(27, 77, 62, 0.28),
              0 0 88px -10px rgba(15, 118, 110, 0.26),
              inset 0 1px 0 rgba(255, 255, 255, 0.98);
            transform: translateY(-8px) scale(1.02);
            filter: saturate(1.08);
            animation: none;
          }

          .emp-story-panel.emp-glass-card:hover {
            transform: translateY(-7px) scale(1.01);
          }

          .emp-feature-icon {
            transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease;
          }

          .emp-glass-card:hover .emp-feature-icon {
            transform: scale(1.08) translateY(-2px);
            box-shadow:
              0 12px 28px -6px rgba(15, 118, 110, 0.35),
              0 0 24px -4px rgba(27, 77, 62, 0.22);
          }

          .emp-stat-row:hover .emp-feature-icon {
            transform: scale(1.08);
            box-shadow:
              0 8px 22px -4px rgba(15, 118, 110, 0.28),
              inset 0 1px 0 rgba(255, 255, 255, 0.95);
          }

          .emp-stat-row {
            border-radius: 1rem;
            padding: 0.35rem 0.5rem 0.35rem 0;
            margin: 0 -0.35rem;
            transition: background 0.35s ease, transform 0.35s ease, box-shadow 0.35s ease;
          }

          .emp-stat-row:hover {
            background: rgba(240, 253, 250, 0.75);
            transform: translateX(4px);
            box-shadow: -6px 0 24px -8px rgba(27, 77, 62, 0.12);
          }

          @keyframes emp-portrait-aura {
            0%, 100% {
              opacity: 0.92;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.06);
            }
          }

          @keyframes emp-portrait-shimmer {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.04); }
          }

          .emp-hero-visual {
            min-height: 430px;
            background: transparent;
          }

          .emp-hero-photo-wrap {
            position: relative;
            isolation: isolate;
            cursor: pointer;
            transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
          }

          .emp-hero-photo-wrap:hover {
            transform: scale(1.035);
          }

          .emp-hero-photo-wrap::before {
            content: "";
            position: absolute;
            inset: -48%;
            z-index: 0;
            pointer-events: none;
            border-radius: 50%;
            background:
              radial-gradient(circle at 38% 36%, rgba(27, 77, 62, 0.72) 0%, transparent 52%),
              radial-gradient(circle at 76% 54%, rgba(15, 118, 110, 0.58) 0%, transparent 48%),
              radial-gradient(circle at 24% 68%, rgba(201, 162, 39, 0.38) 0%, transparent 40%),
              radial-gradient(circle at 54% 18%, rgba(6, 95, 70, 0.48) 0%, transparent 46%);
            filter: blur(58px) saturate(1.28);
            opacity: 1;
            animation: emp-portrait-aura 5.5s ease-in-out infinite;
          }

          .emp-hero-photo-wrap:hover::before {
            filter: blur(64px) saturate(1.38);
            opacity: 1;
          }

          .emp-hero-photo-ring {
            position: relative;
            z-index: 1;
            transition: box-shadow 0.45s ease, transform 0.45s ease;
            box-shadow:
              0 36px 96px -20px rgba(15, 23, 42, 0.58),
              0 0 0 1px rgba(255, 255, 255, 0.98),
              0 0 0 11px rgba(255, 255, 255, 0.48),
              inset 0 0 0 1px rgba(255, 255, 255, 0.6),
              0 0 110px -8px rgba(27, 77, 62, 0.62),
              0 0 72px -4px rgba(15, 118, 110, 0.46),
              0 0 48px 0 rgba(201, 162, 39, 0.22);
          }

          .emp-hero-photo-wrap:hover .emp-hero-photo-ring {
            box-shadow:
              0 44px 110px -18px rgba(15, 23, 42, 0.6),
              0 0 0 1px rgba(255, 255, 255, 1),
              0 0 0 14px rgba(236, 253, 245, 0.62),
              inset 0 0 0 1px rgba(255, 255, 255, 0.72),
              0 0 140px -6px rgba(27, 77, 62, 0.68),
              0 0 96px -2px rgba(15, 118, 110, 0.52),
              0 0 60px 4px rgba(201, 162, 39, 0.28);
          }

          .emp-hero-photo-img {
            transition: filter 0.45s ease, transform 0.6s ease;
            animation: emp-portrait-shimmer 5s ease-in-out infinite;
            filter:
              drop-shadow(0 26px 52px rgba(15, 23, 42, 0.55))
              drop-shadow(0 14px 38px rgba(27, 77, 62, 0.48))
              drop-shadow(0 0 44px rgba(15, 118, 110, 0.38))
              drop-shadow(0 -6px 32px rgba(201, 162, 39, 0.16));
          }

          .emp-hero-photo-wrap:hover .emp-hero-photo-img {
            filter:
              drop-shadow(0 32px 60px rgba(15, 23, 42, 0.58))
              drop-shadow(0 18px 48px rgba(27, 77, 62, 0.52))
              drop-shadow(0 0 56px rgba(15, 118, 110, 0.46))
              drop-shadow(0 -8px 40px rgba(201, 162, 39, 0.22));
            transform: scale(1.03);
          }

          .emp-portrait-card {
            position: relative;
            cursor: pointer;
            overflow: visible;
            isolation: isolate;
            transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.45s ease;
          }

          .emp-portrait-card::after {
            content: "";
            position: absolute;
            inset: -24%;
            z-index: -1;
            border-radius: 50%;
            pointer-events: none;
            background:
              radial-gradient(circle at 44% 40%, rgba(27, 77, 62, 0.55) 0%, transparent 56%),
              radial-gradient(circle at 72% 58%, rgba(15, 118, 110, 0.42) 0%, transparent 50%),
              radial-gradient(circle at 48% 78%, rgba(201, 162, 39, 0.18) 0%, transparent 45%);
            filter: blur(34px) saturate(1.12);
            opacity: 0.92;
            transition: opacity 0.4s ease, filter 0.4s ease;
            animation: emp-portrait-aura 6s ease-in-out infinite 0.5s;
          }

          .emp-portrait-card--rect::after {
            border-radius: 1.5rem;
            inset: -14%;
          }

          .emp-portrait-card:hover::after {
            opacity: 1;
            filter: blur(36px) saturate(1.15);
          }

          .emp-portrait-card:hover {
            transform: scale(1.045);
          }

          .emp-lady3-story-ring {
            transition: box-shadow 0.45s ease;
            box-shadow:
              0 32px 72px -24px rgba(15, 23, 42, 0.52),
              0 0 0 1px rgba(255, 255, 255, 0.95),
              0 0 76px -6px rgba(27, 77, 62, 0.52),
              0 0 52px -2px rgba(15, 118, 110, 0.34),
              0 0 32px 2px rgba(201, 162, 39, 0.16);
          }

          .emp-portrait-card:hover .emp-lady3-story-ring {
            box-shadow:
              0 40px 88px -22px rgba(15, 23, 42, 0.56),
              0 0 0 1px rgba(255, 255, 255, 1),
              0 0 96px -4px rgba(27, 77, 62, 0.6),
              0 0 64px 0 rgba(15, 118, 110, 0.44),
              0 0 44px 4px rgba(201, 162, 39, 0.24);
          }

          .emp-lady3-story-img {
            transition: filter 0.45s ease, transform 0.5s ease;
            filter:
              drop-shadow(0 18px 40px rgba(15, 23, 42, 0.48))
              drop-shadow(0 0 34px rgba(27, 77, 62, 0.38))
              drop-shadow(0 0 24px rgba(15, 118, 110, 0.26));
          }

          .emp-portrait-card:hover .emp-lady3-story-img {
            filter:
              drop-shadow(0 24px 48px rgba(15, 23, 42, 0.52))
              drop-shadow(0 0 46px rgba(27, 77, 62, 0.46))
              drop-shadow(0 0 32px rgba(15, 118, 110, 0.36));
            transform: scale(1.04);
          }

          .emp-lady3-cta-frame {
            transition: box-shadow 0.45s ease, transform 0.45s ease;
            box-shadow:
              0 36px 80px -20px rgba(0, 0, 0, 0.58),
              0 0 60px -4px rgba(27, 77, 62, 0.54),
              0 0 42px 0 rgba(15, 118, 110, 0.38),
              0 0 28px 2px rgba(201, 162, 39, 0.18);
          }

          .emp-portrait-card--rect:hover .emp-lady3-cta-frame {
            box-shadow:
              0 44px 96px -18px rgba(0, 0, 0, 0.62),
              0 0 84px -2px rgba(27, 77, 62, 0.6),
              0 0 56px 2px rgba(15, 118, 110, 0.46),
              0 0 36px 4px rgba(201, 162, 39, 0.26);
          }

          .emp-lady3-cta-img {
            transition: filter 0.45s ease, transform 0.45s ease;
            filter:
              drop-shadow(0 16px 32px rgba(0, 0, 0, 0.46))
              drop-shadow(0 0 26px rgba(27, 77, 62, 0.38))
              drop-shadow(0 0 18px rgba(15, 118, 110, 0.24));
          }

          .emp-portrait-card--rect:hover .emp-lady3-cta-img {
            filter:
              drop-shadow(0 20px 40px rgba(0, 0, 0, 0.52))
              drop-shadow(0 0 38px rgba(27, 77, 62, 0.46))
              drop-shadow(0 0 24px rgba(15, 118, 110, 0.32));
            transform: scale(1.05);
          }

          .emp-btn-premium {
            position: relative;
            overflow: hidden;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.35),
              0 14px 36px -8px rgba(21, 94, 89, 0.45),
              0 4px 12px -4px rgba(15, 23, 42, 0.12);
          }

          .emp-btn-premium::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
            transform: translateX(-100%);
            transition: transform 0.6s ease;
            pointer-events: none;
          }

          .emp-btn-premium:hover::after {
            transform: translateX(100%);
          }

          .emp-cta-panel {
            position: relative;
            overflow: hidden;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            background:
              radial-gradient(ellipse 70% 55% at 12% 0%, rgba(204, 251, 241, 0.35), transparent 60%),
              radial-gradient(ellipse 55% 50% at 88% 20%, rgba(165, 243, 252, 0.25), transparent 55%),
              radial-gradient(ellipse 100% 90% at 50% 120%, rgba(15, 23, 42, 0.45), transparent 55%),
              linear-gradient(118deg, #134e4a 0%, #0f766e 28%, #155e75 58%, #164e63 100%);
          }

          .emp-cta-panel::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(ellipse 42% 38% at 24% 18%, rgba(255, 255, 255, 0.18), transparent 72%),
              radial-gradient(ellipse 50% 40% at 82% 12%, rgba(236, 254, 255, 0.12), transparent 74%),
              radial-gradient(ellipse 80% 48% at 52% 85%, rgba(6, 78, 59, 0.35), transparent 76%);
            mix-blend-mode: soft-light;
            opacity: 0.95;
          }

          .emp-cta-panel::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 42%, rgba(0, 0, 0, 0.18) 100%);
          }

          .emp-cta-panel > div {
            position: relative;
            z-index: 1;
          }

          .emp-heart-outline {
            position: relative;
            width: 220px;
            height: 206px;
          }

          /* CTA band: explicit size so grid track matches (avoid scale() for layout) */
          .emp-cta-panel .emp-heart-outline {
            width: 220px;
            height: 206px;
          }

          .emp-heart-outline-content {
            position: absolute;
            left: 50%;
            top: 42%;
            transform: translate(-50%, -50%);
            display: grid;
            justify-items: center;
            gap: 0.28rem;
            width: 72%;
            text-align: center;
          }

          .emp-heart-outline-content p {
            margin: 0;
            line-height: 1.2;
            white-space: nowrap;
          }

          @media (min-width: 1024px) {
            .emp-cta-panel .emp-heart-outline-content {
              font-size: 0.88rem;
              gap: 0.22rem;
              width: 76%;
            }
          }

          @media (max-width: 1023px) {
            .emp-script {
              font-size: 2.3rem;
            }
            .emp-title {
              font-size: 2.4rem;
            }
            .emp-title-main {
              white-space: normal;
            }
            .emp-body {
              font-size: 0.98rem;
              line-height: 1.55;
            }
            .emp-point-list {
              grid-template-columns: 1fr;
              font-size: 0.96rem;
              row-gap: 0.55rem;
            }
            .emp-hero-visual {
              min-height: 280px;
            }
            .emp-hero-content {
              padding: 0.65rem 1.25rem 1.5rem;
            }
            .emp-heart-outline {
              width: 178px;
              height: 166px;
            }
            .emp-heart-outline-content {
              top: 41%;
              width: 76%;
              gap: 0.22rem;
            }
          }
        `}
      </style>
      <LandingStylePageBackground />
      <div className="relative z-50">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
        />
      </div>
      <section id="home" className="emp-hero-section relative z-0 w-full min-h-screen m-0 p-0 overflow-hidden">
        <div className="relative isolate min-h-screen overflow-hidden border-b border-white/40 bg-white/[0.45] shadow-[inset_0_-1px_0_rgba(255,255,255,0.6)] backdrop-blur-2xl">
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
        <div className="relative z-10 grid min-h-screen items-stretch lg:grid-cols-[1.05fr_1fr]">
            <div className="emp-hero-left w-full min-h-screen m-0 p-0 flex items-center">
              <div className="emp-hero-content">
              <p className="emp-script">
                <span className="emp-script-heart" aria-hidden="true">❤</span>
                <span>EmpowerHer by SewServe</span>
              </p>
              <h1 className="emp-title">
                <span className="emp-title-main">Empowering Women</span>
                <span className="emp-title-accent">Building Futures</span>
              </h1>
              <p className="emp-body">
                SewServe is more than a platform. It is a movement to create opportunities for women through
                tailoring, income, and flexible work.
              </p>

              <ul className="emp-point-list">
                <li className="emp-point-item">
                  <Home size={17} strokeWidth={2.25} className="shrink-0 text-[#1e293b]" />
                  Work from Home
                </li>
                <li className="emp-point-item">
                  <Clock3 size={17} strokeWidth={2.25} className="shrink-0 text-[#1e293b]" />
                  Flexible Hours
                </li>
                <li className="emp-point-item">
                  <UserPlus size={17} strokeWidth={2.25} className="shrink-0 text-[#1e293b]" />
                  Be Your Own Boss
                </li>
                <li className="emp-point-item">
                  <TrendingUp size={17} strokeWidth={2.25} className="shrink-0 text-[#1e293b]" />
                  Earn with Skills
                </li>
              </ul>

              <div className="emp-cta-row">
                <button
                  type="button"
                  onClick={goToTailorSignup}
                  className="emp-btn-premium inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-[#3d6b4f] to-[#2d4f3c] px-7 py-3 text-[15px] font-semibold text-white transition duration-200 hover:brightness-110"
                >
                  Join as Tailor Today
                  <ArrowRight size={17} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSectionNavigate("about")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/60 px-5 py-3 text-[15px] font-semibold text-[#1e3a2f] shadow-sm backdrop-blur-sm transition hover:border-teal-200/80 hover:bg-white/90"
                >
                  Learn More
                  <ArrowRight size={17} strokeWidth={2.25} />
                </button>
              </div>
              </div>
            </div>

            <div className="emp-hero-visual relative flex w-full min-h-screen items-center justify-center overflow-visible p-6 pb-10 pt-8 lg:justify-end lg:pr-8 lg:pt-0 lg:pb-0">
              <div className="emp-hero-photo-wrap relative mx-auto flex w-full max-w-[min(92vw,560px)] items-center justify-center lg:mx-0 lg:max-w-none">
                <div className="emp-hero-photo-ring relative aspect-square w-[min(88vw,420px)] overflow-hidden rounded-full sm:w-[min(82vw,460px)] lg:w-[min(52vw,520px)]">
                  <img
                    src={heroImage}
                    alt="Woman tailoring at sewing machine"
                    className="emp-hero-photo-img h-full w-full object-cover object-[center_38%]"
                  />
                </div>
                <div className="emp-hero-badge absolute left-1/2 top-[calc(100%-1.25rem)] z-[6] grid h-[148px] w-[148px] -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border-[3px] border-dashed border-white/90 bg-gradient-to-br from-[#3d6b4a] to-[#2d5238] px-2.5 text-center text-[10.5px] font-bold leading-snug text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.45)] transition duration-300 hover:scale-105 hover:shadow-[0_22px_48px_-10px_rgba(27,77,62,0.55),0_0_32px_-4px_rgba(15,118,110,0.35)] sm:h-[152px] sm:w-[152px] sm:text-[11px] lg:left-0 lg:top-1/2 lg:-translate-x-[46%] lg:-translate-y-1/2">
                  <p>Your Skills</p>
                  <p>Your Income</p>
                  <p>Your Freedom</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 w-full mx-0 px-0">
        <section id="about" className="w-full mx-0 px-0 py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p className="emp-section-kicker">Why join</p>
            <div className="mb-10 flex flex-wrap items-center justify-center gap-5">
              <span className="hidden h-px w-12 bg-gradient-to-r from-transparent to-teal-400/60 sm:block sm:w-20" />
              <h2 className="emp-section-title text-[clamp(1.85rem,4vw,2.75rem)] text-[#0f172a]">
                Why This Platform is for You
              </h2>
              <span className="hidden h-px w-12 bg-gradient-to-l from-transparent to-teal-400/60 sm:block sm:w-20" />
            </div>
          </div>
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
            {featureCards.map((card, index) => (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.08, duration: 0.45, type: "spring", stiffness: 380, damping: 26 }}
                className="group emp-glass-card rounded-[1.35rem] px-6 py-9 text-center"
              >
                <div className="emp-feature-icon mx-auto mb-5 grid h-[4.25rem] w-[4.25rem] place-content-center rounded-2xl bg-gradient-to-br from-teal-500/90 to-emerald-700/90 shadow-lg shadow-teal-900/15 ring-1 ring-white/40">
                  <card.icon size={26} className="text-white" strokeWidth={2} />
                </div>
                <h3 className="font-['Poppins',sans-serif] text-lg font-semibold leading-snug text-[#0f172a]">{card.title}</h3>
                <p className="mt-3 font-['Inter',sans-serif] text-[0.9375rem] font-medium leading-relaxed text-slate-600">
                  {card.description}
                </p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="w-full mx-0 px-0 py-16 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="emp-story-panel emp-glass-card mx-4 rounded-[2rem] px-5 py-8 shadow-xl sm:mx-auto sm:max-w-6xl sm:px-8 lg:px-10 lg:py-10"
          >
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,280px)_1fr_minmax(0,300px)] lg:gap-12">
              <div className="emp-portrait-card mx-auto w-fit">
                <div className="mx-auto h-[230px] w-[230px] overflow-hidden rounded-full border-[3px] border-white/90 emp-lady3-story-ring ring-1 ring-slate-200/50 sm:h-[280px] sm:w-[280px] lg:h-[300px] lg:w-[300px]">
                  <img
                    src={storyImage}
                    alt="SewServe partner tailor"
                    className="emp-lady3-story-img h-full w-full object-cover object-center"
                  />
                </div>
              </div>

              <div className="text-[#0f172a]">
                <p className="-mb-2 font-['Cormorant_Garamond',serif] leading-none text-teal-600/90" style={{ fontSize: "4rem" }}>
                  ❝
                </p>
                <p className="emp-section-kicker text-left">Stories</p>
                <h3 className="emp-section-title mt-1 text-[clamp(2rem,4vw,3.5rem)] text-[#0f172a]">Inspiring Stories</h3>
                <div className="mt-4 h-px w-full max-w-md bg-gradient-to-r from-teal-400/50 via-slate-200 to-transparent" />
                <p className="mt-5 max-w-[34rem] text-[1.05rem] font-medium leading-relaxed text-slate-600 sm:text-[1.125rem] lg:leading-8">
                  &ldquo;I started with one machine and small dreams. Today, I make 20+ orders every month and support my
                  family with pride.&rdquo;
                </p>
                <p className="mt-6 font-serif text-2xl font-semibold italic text-[#134e4a] sm:text-[1.75rem]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  — Ayesha Khan
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-slate-500">SewServe Partner Tailor</p>
              </div>

              <div className="space-y-4">
                {stats.map((item, index) => {
                  const Icon = [UserPlus, Scissors, TrendingUp][index];
                  return (
                    <div
                      key={item.label}
                      className="emp-stat-row flex items-center gap-4 border-b border-slate-200/80 pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="emp-feature-icon grid h-14 w-14 shrink-0 place-content-center rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-100 text-teal-800 shadow-inner ring-1 ring-white/80">
                        <Icon size={26} strokeWidth={2.1} />
                      </div>
                      <div>
                        <p className="text-[2.25rem] font-semibold leading-none text-[#0f172a] sm:text-[2.5rem] lg:text-[2.75rem]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                          {item.value}
                        </p>
                        <p className="mt-1 text-[0.95rem] font-medium text-slate-600 sm:text-base">{item.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </section>

        <section id="contact" className="emp-cta-panel w-full mx-0 px-0 py-6 text-white lg:py-8">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-6 md:grid-cols-[minmax(0,240px)_1fr] md:gap-8 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_236px] lg:gap-x-10 lg:gap-y-4">
            <div className="emp-portrait-card emp-portrait-card--rect mx-auto w-full max-w-[240px] lg:mx-0">
              <div className="overflow-hidden rounded-[1.35rem] border border-white/30 bg-white/15 p-2 emp-lady3-cta-frame backdrop-blur-md">
                <img
                  src={storyImage}
                  alt="Tailor illustration"
                  className="emp-lady3-cta-img h-[152px] w-full rounded-2xl object-cover object-center ring-1 ring-white/20 sm:h-[160px] lg:h-[164px]"
                />
              </div>
            </div>
            <div className="relative z-[3] min-w-0 text-center md:text-left lg:pr-2">
              <p className="emp-section-kicker">Partner with us</p>
              <h3 className="emp-section-title max-w-full text-[clamp(1.45rem,1rem+2.1vw,2.35rem)] font-semibold leading-[1.12] tracking-tight text-white lg:whitespace-nowrap xl:text-[clamp(1.55rem,1rem+1.65vw,2.55rem)]">
                Start Your Journey Today!
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-[1.05rem] font-medium leading-relaxed text-white/85 sm:mt-3.5 sm:text-[1.125rem] md:mx-0">
                Your talent can change your life. We are here to support you every step of the way.
              </p>
              <div className="mt-5 flex justify-center md:justify-start">
                <button
                  type="button"
                  onClick={goToTailorSignup}
                  className="emp-btn-premium inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-[15px] font-bold text-[#0f2937] shadow-lg transition hover:bg-teal-50"
                >
                  Become a Partner Tailor
                  <ArrowRight size={18} strokeWidth={2.25} />
                </button>
              </div>
            </div>
            <div className="relative z-0 flex w-full max-w-[220px] justify-center justify-self-center md:max-w-none md:justify-center lg:max-w-none lg:justify-end lg:justify-self-end">
              <div className="emp-heart-outline shrink-0">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 220 206" aria-hidden="true">
                  <path
                    d="M110 192C105 183 89 164 71 149C36 121 14 94 14 62C14 34 35 14 62 14C82 14 98 23 110 39C122 23 138 14 158 14C185 14 206 34 206 62C206 94 184 121 149 149C131 164 115 183 110 192Z"
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                </svg>
                <div className="emp-heart-outline-content text-[14px] font-semibold text-white/95 sm:text-[13px]">
                  <p>Stronger Women</p>
                  <p>Stronger Society</p>
                  <p>Stronger Tomorrow</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
