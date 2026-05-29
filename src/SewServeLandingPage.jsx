import React, { useEffect, useMemo, useState } from "react";
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
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import LandingHeroSection from "./components/landing/LandingHeroSection.jsx";
import HowItWorksSplitSection from "./components/HowItWorksSplitSection.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
import { fetchTestimonials } from "./api/testimonialsApi.js";
import { openFreshMeasurementWizard } from "./utils/wizardNavigation.js";
const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

/** Marketing value props (moved from hero) â€” shown with icon tiles in Features */
const valueProps = [
  { label: "Custom Alterations", icon: Scissors },
  { label: "Expert Tailors", icon: UsersRound },
  { label: "Exceptional Service", icon: HeartHandshake },
  { label: "Fast", icon: Zap },
  { label: "Reliable", icon: BadgeCheck },
  { label: "Professional Tailoring Platform", icon: Briefcase },
];

/** Premium hero highlights â€” glass cards below CTAs */
const heroHighlights = [
  {
    title: "Expert Tailors",
    description: "Verified local professionals you can trust.",
    icon: UsersRound,
  },
  {
    title: "Real-Time Tracking",
    description: "Live updates from stitch to delivery.",
    icon: MapPinned,
  },
  {
    title: "At-Home Measurements",
    description: "Guided digital fitting at your pace.",
    icon: Ruler,
  },
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
    route: "/track-orders#order-tracking",
  },
  {
    title: "Trusted Local Tailors",
    bannerLabel: "Local Tailors",
    description: "Connect with verified professionals in your area for reliable, high-quality service.",
    icon: ShieldCheck,
    route: "/browse-tailors",
  },
];

const staticTestimonials = [
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
  const [storedTestimonials, setStoredTestimonials] = useState([]);

  const goToMeasurementWizard = () => {
    void openFreshMeasurementWizard(navigate);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const rows = await fetchTestimonials();
      if (cancelled) return;
      setStoredTestimonials(Array.isArray(rows) ? rows : []);
    };
    void load();
    const onUpdated = () => {
      void load();
    };
    window.addEventListener("sewserve:testimonials-updated", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("sewserve:testimonials-updated", onUpdated);
    };
  }, []);

  const testimonials = useMemo(() => {
    const fromApi = (Array.isArray(storedTestimonials) ? storedTestimonials : [])
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        name: typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Customer",
        feedback: typeof t.feedback === "string" ? t.feedback : "",
        avatar: typeof t.avatar === "string" && t.avatar ? t.avatar : "https://i.pravatar.cc/64?img=12",
      }))
      .filter((t) => t.feedback.trim());

    const merged = [...fromApi, ...staticTestimonials];
    const seen = new Set();
    const deduped = [];
    for (const t of merged) {
      const key = `${t.name}::${t.feedback}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(t);
      if (deduped.length >= 3) break; // keep the 3-card layout
    }
    return deduped;
  }, [storedTestimonials]);

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
    <div className="relative isolate min-h-screen bg-transparent text-[#3d5a73] antialiased">
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

/* Apple-style frosted panels â€” sections / chrome (low fill, strong blur + saturation) */
.ss-glass-surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(15, 23, 42, 0.04);
}

/* Product cards â€” same backdrop layer as Measurement Wizard (soft fog, low contrast) */
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

`}
      </style>

      <LandingStylePageBackground />

      {/* Nav outside z-10 wrapper so it stacks above the fixed page wash; glassmorphism + scroll elevation */}
      <LandingNavbar
        logoDisplaySrc={logoDisplaySrc}
        navLinks={navLinks}
        onSectionNavigate={handleSectionNavigate}
      />

      <div className="relative z-10 min-h-screen font-['Inter',sans-serif]">
        <LandingHeroSection
          heroHighlights={heroHighlights}
          goToMeasurementWizard={goToMeasurementWizard}
          onExploreTailors={() => navigate("/browse-tailors")}
        />

        {/* Features Section */}
        <motion.section
          id="about"
          className="ss-glass-surface relative z-[2] border-t border-white/35 pt-12 pb-20 shadow-[0_-8px_32px_-16px_rgba(26,53,88,0.08),0_20px_56px_-24px_rgba(26,53,88,0.08)] sm:pt-14 sm:pb-24 md:pt-16 md:pb-28"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-['Playfair_Display',Georgia,serif] text-3xl font-bold tracking-tight text-[#1a3558] sm:text-4xl">Features</h2>
              <p className="mt-3 text-base leading-[1.65] text-[#5a7a92]">
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
          className="ss-glass-surface relative z-[1] border-t border-white/30 py-20 shadow-[0_20px_56px_-24px_rgba(26,53,88,0.08)] sm:py-24 md:py-28"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-['Playfair_Display',Georgia,serif] text-3xl font-bold tracking-tight text-[#1a3558] sm:text-4xl">Testimonials</h2>
              <p className="mt-3 text-base leading-[1.65] text-[#5a7a92]">
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
              {/* Column 1 â€” Brand & socials */}
              <div className="flex flex-col gap-5 lg:pr-8">
                <a
                  href="#home"
                  className="inline-flex w-fit shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600/30"
                  aria-label="SewServe home"
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
                  <p className="text-xs text-slate-600">Copyright 2026 SewServe. All rights reserved.</p>
                  <div className="mt-3 flex flex-col gap-2 text-xs text-slate-600">
                    <button
                      type="button"
                      className="w-fit text-left transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                    >
                      Privacy Policy
                    </button>
                    <button
                      type="button"
                      className="w-fit text-left transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                    >
                      Terms &amp; Conditions
                    </button>
                  </div>
                </div>
              </div>

              {/* Column 2 â€” Quick Links */}
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
                        -
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

              {/* Column 3 â€” Our Services */}
              <div className="lg:px-8">
                <h3 className="text-sm font-bold text-slate-800">Our Services</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  {["Custom Tailoring", "Alterations", "Wedding Attire", "Bespoke Suits"].map((label) => (
                    <li key={label} className="flex gap-2">
                      <span className="text-slate-400" aria-hidden>
                        -
                      </span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 4 â€” Get in touch & newsletter */}
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
