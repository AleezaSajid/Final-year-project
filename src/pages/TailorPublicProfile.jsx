import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import LandingNavbar from "../components/LandingNavbar";
import { LandingStylePageBackground } from "../components/LandingStylePageBackground";
import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";
import SendRequestModal from "../components/SendRequestModal";
import { fetchPublicTailorById } from "../api/tailorsPublicApi";
import { getTailorById } from "../data/browseTailorsMock";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

export default function TailorPublicProfile() {
  const { tailorId } = useParams();
  const navigate = useNavigate();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);
  const [tailor, setTailor] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolved(false);
    setTailor(null);
    (async () => {
      const { tailor: apiTailor } = await fetchPublicTailorById(tailorId);
      if (cancelled) return;
      setTailor(apiTailor || getTailorById(tailorId));
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tailorId]);

  useEffect(() => {
    document.title = tailor ? `${tailor.name} | SewServe` : "Tailor | SewServe";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      tailor
        ? `${tailor.name} — ${tailor.specialty}. Browse tailors on SewServe.`
        : "Tailor profile on SewServe."
    );
  }, [tailor]);

  const handleSectionNavigate = (sectionId) => {
    navigate("/", { state: { scrollTo: sectionId } });
  };

  if (!resolved) {
    return (
      <div className="relative isolate min-h-screen bg-transparent text-slate-600 antialiased">
        <LandingStylePageBackground />
        <div className="relative z-10 mx-auto max-w-lg px-6 py-24 text-center font-['Inter',sans-serif]">
          <p className="text-lg font-semibold text-slate-900">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!tailor) {
    return (
      <div className="relative isolate min-h-screen bg-transparent text-slate-600 antialiased">
        <LandingStylePageBackground />
        <div className="relative z-10 mx-auto max-w-lg px-6 py-24 text-center font-['Inter',sans-serif]">
          <p className="text-lg font-semibold text-slate-900">Tailor not found</p>
          <p className="mt-2 text-slate-600">This profile may have been removed or the link is incorrect.</p>
          <Link
            to="/browse-tailors"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Browse Tailors
          </Link>
        </div>
      </div>
    );
  }

  const fullStars = Math.floor(tailor.rating);
  const hasHalf = tailor.rating - fullStars >= 0.5;

  return (
    <div className="relative isolate min-h-screen bg-transparent text-slate-600 antialiased">
      <LandingStylePageBackground />
      <style>
        {`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
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
.ss-glass-surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(15, 23, 42, 0.04);
}
`}
      </style>

      <div className="relative z-10 font-['Inter',sans-serif]">
        <LandingNavbar logoDisplaySrc={logoDisplaySrc} navLinks={navLinks} onSectionNavigate={handleSectionNavigate} />

        <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8 lg:py-14">
          <Link
            to="/browse-tailors"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 transition hover:text-emerald-950"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to listings
          </Link>

          <div className="ss-glass-surface mt-8 overflow-hidden rounded-2xl border border-white/40 shadow-lg">
            <div className="grid gap-0 md:grid-cols-[280px_1fr]">
              <div className="relative aspect-[4/3] bg-slate-100 md:aspect-auto md:min-h-[280px]">
                <img src={tailor.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="font-['Georgia',serif] text-2xl font-bold text-slate-900 sm:text-3xl">{tailor.name}</h1>
                    <p className="mt-1 text-emerald-800/90">{tailor.specialty}</p>
                    <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 text-emerald-600" aria-hidden />
                      {tailor.city} · {tailor.distanceKm} km away
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      tailor.availability === "available" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {tailor.availability === "available" ? "Available" : "Busy"}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => {
                      const filled = i < fullStars || (i === fullStars && hasHalf);
                      return (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${filled ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`}
                          strokeWidth={filled ? 0 : 1.5}
                          aria-hidden
                        />
                      );
                    })}
                  </div>
                  <span className="text-lg font-bold text-slate-900">{tailor.rating.toFixed(1)}</span>
                  <span className="text-slate-500">· {tailor.experienceYears} years experience</span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Starting price</p>
                    <p className="mt-1 text-lg font-bold text-emerald-900">{tailor.priceLabel.replace(/^Starting from\s*/i, "")}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Typical turnaround</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">~{tailor.deliveryDays} days</p>
                  </div>
                </div>

                <p className="mt-8 text-sm leading-relaxed text-slate-600">
                  {tailor.bio && String(tailor.bio).trim() ? (
                    <>{String(tailor.bio).trim()}</>
                  ) : (
                    <>
                      This is a preview profile for <strong>{tailor.name}</strong>. When your backend is connected, this page can
                      show portfolios, reviews, and live availability.
                    </>
                  )}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/browse-tailors"
                    className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-emerald-400 hover:text-emerald-900"
                  >
                    Browse more tailors
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRequestOpen(true)}
                    className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
                  >
                    Request tailor (measurements &amp; design)
                  </button>
                  <Link
                    to="/login"
                    className="rounded-full border border-emerald-200 bg-white px-6 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <SendRequestModal open={requestOpen} tailor={tailor} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
