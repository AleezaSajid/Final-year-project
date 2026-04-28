import { motion } from "framer-motion";
import { ArrowRight, Clock3, Home, Scissors, TrendingUp, UserPlus } from "lucide-react";
import { useMemo } from "react";
import LandingNavbar from "../components/LandingNavbar";
import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
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

const workSteps = [
  {
    title: "Create Profile",
    description: "Sign up in minutes and set your tailoring specialties.",
    icon: UserPlus,
    color: "from-pink-400 to-fuchsia-400",
  },
  {
    title: "Receive Orders",
    description: "Get matched with relevant stitching requests near you.",
    icon: Scissors,
    color: "from-violet-500 to-purple-500",
  },
  {
    title: "Stitch & Earn",
    description: "Deliver quality work and receive secure payouts on time.",
    icon: TrendingUp,
    color: "from-cyan-400 to-teal-400",
  },
];

const stats = [
  { value: "1000+", label: "Women Empowered" },
  { value: "5000+", label: "Orders Completed" },
  { value: "100%", label: "Growth & Support" },
];

export default function EmpowerHer() {
  const heroImage = useMemo(
    () => `${process.env.PUBLIC_URL || ""}/lady3.png`,
    []
  );
  const storyImage = useMemo(
    () => `${process.env.PUBLIC_URL || ""}/lady2.png`,
    []
  );
  const logoSrc = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;
  const logoDisplaySrc = useSewServeLogoProcessedSrc(logoSrc);

  const handleSectionNavigate = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="emp-page relative isolate min-h-screen bg-transparent text-slate-900">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap');

          .emp-page {
            font-family: 'Inter', sans-serif;
            overflow-x: hidden;
          }

          .emp-page h1,
          .emp-page h2,
          .emp-page h3 {
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
          }

          .emp-page p,
          .emp-page li {
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            font-size: 1rem;
          }

          .emp-page button {
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: none;
            letter-spacing: normal;
          }

          .emp-label {
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: none;
            letter-spacing: normal;
          }

          /* Same full-viewport animated wash as SewServeLandingPage */
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

          .emp-hero-shell {
            background: #ffffff;
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
            font-family: 'Poppins', sans-serif;
            font-size: 3.3rem;
            line-height: 1;
            font-style: normal;
            font-weight: 900;
            color: #2f6e73;
            letter-spacing: -0.01em;
            display: inline-flex;
            align-items: center;
            gap: 0.55rem;
          }

          .emp-script-heart {
            color: #5dc8bf;
            font-size: 0.92em;
          }

          .emp-title {
            font-family: 'Poppins', sans-serif;
            margin-top: 0.85rem;
            font-size: clamp(2.35rem, 3.9vw, 3.2rem);
            line-height: 1.02;
            letter-spacing: -0.02em;
            font-weight: 700;
            color: #0f172a;
          }

          .emp-title-main {
            display: block;
            white-space: nowrap;
          }

          .emp-title-accent {
            font-family: 'Inter', sans-serif;
            display: block;
            margin-top: 0.22rem;
            font-size: inherit;
            font-weight: 700;
            line-height: inherit;
            color: #6a4da8;
          }

          .emp-body {
            margin-top: 1rem;
            font-size: 1.02rem;
            line-height: 1.62;
            color: #374151;
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
            border: 1px solid rgba(255, 255, 255, 0.35);
            background: linear-gradient(160deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.08) 100%);
            -webkit-backdrop-filter: blur(24px) saturate(165%);
            backdrop-filter: blur(24px) saturate(165%);
            box-shadow:
              0 2px 20px -4px rgba(15, 23, 42, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.35);
            transition: background 0.2s ease, border-color 0.2s ease;
          }

          .emp-glass-card:hover {
            border-color: rgba(255, 255, 255, 0.42);
            background: linear-gradient(160deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.1) 100%);
          }

          .emp-hero-visual {
            min-height: 430px;
            background: transparent;
          }

          .emp-hero-photo-ring {
            box-shadow:
              0 28px 64px -24px rgba(15, 23, 42, 0.22),
              0 0 0 1px rgba(255, 255, 255, 0.85),
              inset 0 0 0 1px rgba(255, 255, 255, 0.35);
          }

          .emp-cta-panel {
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(ellipse 52% 46% at 18% 10%, rgba(187, 247, 242, 0.2), transparent 70%),
              radial-gradient(ellipse 60% 54% at 52% 58%, rgba(44, 151, 164, 0.5), transparent 74%),
              radial-gradient(ellipse 120% 95% at 50% 132%, rgba(6, 47, 66, 0.52), transparent 69%),
              linear-gradient(112deg, #2ab1b0 0%, #1699a0 36%, #0d7b90 66%, #0a5f7d 100%);
          }

          .emp-cta-panel::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(ellipse 38% 40% at 22% 22%, rgba(221, 255, 251, 0.2), transparent 72%),
              radial-gradient(ellipse 44% 35% at 84% 16%, rgba(188, 242, 234, 0.17), transparent 74%),
              radial-gradient(ellipse 75% 45% at 54% 82%, rgba(7, 80, 106, 0.32), transparent 76%);
            mix-blend-mode: screen;
            opacity: 0.95;
          }

          .emp-cta-panel::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(0, 33, 56, 0.2) 100%);
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
      <div className="ss-page-bg-anim" aria-hidden="true" />
      <div className="relative z-10">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
        />
      </div>
      <section id="home" className="emp-hero-section relative z-10 w-full min-h-screen m-0 p-0 overflow-hidden">
        <div className="relative isolate min-h-screen overflow-hidden border-b border-white/25 bg-white/[0.06] backdrop-blur-xl">
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
                <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] px-6 py-2.5 text-[15px] font-semibold text-white transition hover:brightness-105">
                  Join as Tailor Today
                  <ArrowRight size={17} />
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl bg-transparent px-1 py-2.5 text-[15px] font-semibold text-[#3d5d48] transition hover:text-[#2f4a3a]">
                  Learn More
                  <ArrowRight size={17} />
                </button>
              </div>
              </div>
            </div>

            <div className="emp-hero-visual relative flex w-full min-h-screen items-center justify-center overflow-visible p-6 pb-10 pt-8 lg:justify-end lg:pr-8 lg:pt-0 lg:pb-0">
              <div className="relative mx-auto flex w-full max-w-[min(92vw,560px)] items-center justify-center lg:mx-0 lg:max-w-none">
                <div className="emp-hero-photo-ring relative aspect-square w-[min(88vw,420px)] overflow-hidden rounded-full sm:w-[min(82vw,460px)] lg:w-[min(52vw,520px)]">
                  <img
                    src={heroImage}
                    alt="Woman tailoring at sewing machine"
                    className="h-full w-full object-cover object-[center_38%]"
                  />
                </div>
                <div className="absolute left-1/2 top-[calc(100%-1.25rem)] z-[6] grid h-[148px] w-[148px] -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border-[3px] border-dashed border-white/90 bg-gradient-to-br from-[#3d6b4a] to-[#2d5238] px-2.5 text-center text-[10.5px] font-bold leading-snug text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.45)] sm:h-[152px] sm:w-[152px] sm:text-[11px] lg:left-0 lg:top-1/2 lg:-translate-x-[46%] lg:-translate-y-1/2">
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
        <section id="about" className="w-full mx-0 px-0 py-16">
          <div className="mb-8 flex items-center justify-center gap-4 px-6 text-center">
            <span className="h-[2px] w-16 rounded-full bg-[#8ad3c9]/80" />
            <h2 className="font-['Poppins',sans-serif] text-3xl font-semibold text-[#1f4259]">Why This Platform is for You</h2>
            <span className="h-[2px] w-16 rounded-full bg-[#8ad3c9]/80" />
          </div>
          <div className="grid w-full gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((card, index) => (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="emp-glass-card rounded-3xl px-6 py-8 text-center"
              >
                <div className="mx-auto mb-4 grid h-16 w-16 place-content-center rounded-full bg-gradient-to-r from-[#66c3bd] to-[#4aa59f]">
                  <card.icon size={24} className="text-white" />
                </div>
                <h3 className="font-['Poppins',sans-serif] text-lg font-semibold leading-tight text-[#1f4259]">{card.title}</h3>
                <p className="mt-3 font-['Inter',sans-serif] text-sm font-medium leading-7 text-[#2c4d63]">{card.description}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="w-full mx-0 px-0 py-12">
          <div className="mb-6 flex items-center justify-center gap-4 px-6 text-center">
            <span className="h-[1.5px] w-24 rounded-full bg-[#94c7cf]/70" />
            <h2 className="font-['Inter',sans-serif] text-[46px] font-semibold text-[#1f4259] sm:text-4xl">How It Works</h2>
            <span className="h-[1.5px] w-24 rounded-full bg-[#94c7cf]/70" />
          </div>
          <div className="grid w-full gap-4 px-6 md:grid-cols-3">
            {workSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.12, duration: 0.4 }}
                className="emp-glass-card relative rounded-2xl px-5 py-4"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-content-center rounded-xl bg-gradient-to-r from-[#39a592] to-[#2b8f75] text-white shadow-sm">
                    {index === 1 ? (
                      <step.icon size={18} className="text-white" />
                    ) : (
                      <span className="font-['Poppins',sans-serif] text-[30px] font-bold leading-none">{index + 1}</span>
                    )}
                  </div>
                  <h3 className="font-['Poppins',sans-serif] text-[34px] font-semibold leading-tight text-[#1f4259] sm:text-2xl">
                    {step.title}
                  </h3>
                </div>
                <div className="my-2 h-px w-full bg-[#9cc7d1]/65" />
                <p className="text-[16px] leading-8 text-[#29445a] sm:text-base">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="w-full mx-0 px-0 py-14">
          <div className="emp-glass-card mx-4 rounded-[28px] px-4 py-6 sm:mx-6 sm:px-5 lg:px-7">
            <div className="grid items-center gap-7 lg:grid-cols-[320px_1fr_320px]">
              <div className="mx-auto h-[230px] w-[230px] overflow-hidden rounded-full border border-white/70 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] sm:h-[300px] sm:w-[300px]">
                <img
                  src={storyImage}
                  alt="SewServe partner tailor"
                  className="h-full w-full object-cover object-center"
                />
              </div>

              <div className="text-[#1f4259]">
                <p className="-mb-4 leading-none text-[#62c3bc]" style={{ fontSize: "4.5rem" }}>❝</p>
                <h3 className="mt-0 font-['Poppins',sans-serif] text-[34px] font-semibold leading-[1.05] text-[#1f4259] sm:text-[40px] lg:text-[56px]">Inspiring Stories</h3>
                <div className="mt-3 h-px w-full bg-[#9ec4cc]/70" />
                <p className="mt-4 max-w-[620px] text-[17px] font-medium leading-8 text-[#23445b] sm:text-[18px] lg:text-[20px] lg:leading-9">
                  "I started with one machine and small dreams. Today, I make 20+ orders every month and support my
                  family with pride."
                </p>
                <p className="mt-5 text-[22px] font-semibold leading-tight text-[#23445b] sm:text-[22px] lg:text-[30px]">— Pushpa Sharma</p>
                <p className="text-[17px] font-medium leading-tight text-[#2f5670] lg:text-[22px]">SewServe Partner Tailor</p>
              </div>

              <div className="space-y-3">
                {stats.map((item, index) => {
                  const Icon = [UserPlus, Scissors, TrendingUp][index];
                  return (
                    <div key={item.label} className="flex items-center gap-4 border-b border-[#9ec4cc]/55 pb-3 last:border-b-0 last:pb-0">
                      <div className="grid h-16 w-16 place-content-center rounded-full bg-gradient-to-br from-[#d7eff0] to-[#c5e7e7] text-[#21707a]">
                        <Icon size={30} strokeWidth={2.1} />
                      </div>
                      <div>
                        <p className="font-['Poppins',sans-serif] text-[36px] font-semibold leading-tight text-[#1f4259] sm:text-[42px] lg:text-[56px]">{item.value}</p>
                        <p className="text-[18px] font-medium leading-tight text-[#254d66] sm:text-[19px] lg:text-[26px]">{item.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="emp-cta-panel w-full mx-0 px-0 py-10 text-white">
          <div className="grid w-full items-center gap-8 px-6 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr_220px]">
            <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-3xl border border-white/25 bg-white/10 p-2 shadow-[0_20px_45px_-25px_rgba(2,32,36,0.65)]">
              <img
                src={storyImage}
                alt="Tailor illustration"
                className="h-[160px] w-full rounded-2xl object-cover object-center"
              />
            </div>
            <div>
              <h3 className="font-['Poppins',sans-serif] text-[56px] font-semibold leading-tight text-white sm:text-[44px]">
                Start Your Journey Today!
              </h3>
              <p className="mt-3 max-w-[640px] text-[20px] font-medium leading-9 text-white/90 sm:text-[18px]">
                Your talent can change your life. We are here to support you every step of the way.
              </p>
              <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/90 px-6 py-3 text-sm font-bold text-[#1f4259] transition hover:bg-white">
                Become a Partner Tailor
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="grid place-content-center">
              <div className="emp-heart-outline">
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
