import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import LandingNavbar from "../components/LandingNavbar";
import { LandingStylePageBackground } from "../components/LandingStylePageBackground";
import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";
import TailorCard from "../components/TailorCard";
import SendRequestModal from "../components/SendRequestModal";
import { fetchPublicTailors } from "../api/tailorsPublicApi";
import {
  RATING_OPTIONS,
  PRICE_OPTIONS,
  DELIVERY_OPTIONS,
  EXPERIENCE_BAR_OPTIONS,
  CATEGORY_LABELS,
  SORT_OPTIONS,
  matchesFilters,
  categorySetFromParam,
  categoryParamFromSet,
} from "../data/browseTailorsMock";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const navLinks = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

function ratingToSliderIndex(r) {
  if (r === "4") return 1;
  if (r === "4.5") return 2;
  return 0;
}

function sliderIndexToRating(i) {
  if (i >= 2) return "4.5";
  if (i >= 1) return "4";
  return "any";
}

function priceToSliderIndex(p) {
  const m = { any: 0, low: 1, mid: 2, high: 3 };
  return m[p] ?? 0;
}

function sliderIndexToPrice(i) {
  return ["any", "low", "mid", "high"][Math.min(3, Math.max(0, i))] ?? "any";
}

function quickLabelRating(v) {
  const o = RATING_OPTIONS.find((x) => x.value === v);
  return o?.label ?? "Rating";
}

function quickLabelPrice(v) {
  const o = PRICE_OPTIONS.find((x) => x.value === v);
  return o?.label ?? "Price";
}

function quickLabelDelivery(v) {
  const o = DELIVERY_OPTIONS.find((x) => x.value === v);
  return o?.label ?? "Delivery";
}

function quickLabelExperience(v) {
  const o = EXPERIENCE_BAR_OPTIONS.find((x) => x.value === v);
  return o?.label ?? "Experience";
}

const dropdownPill =
  "inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-emerald-200/80 hover:bg-white hover:shadow-md active:scale-95";

export default function BrowseTailors() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("any");
  const [price, setPrice] = useState("any");
  const [delivery, setDelivery] = useState("any");
  const [experienceBar, setExperienceBar] = useState("any");
  const [categoryUi, setCategoryUi] = useState(() => new Set());
  const [sortBy, setSortBy] = useState("rating");
  const [filterMenu, setFilterMenu] = useState(null);
  const [requestFor, setRequestFor] = useState(null);
  const [tailorDataset, setTailorDataset] = useState([]);
  const [tailorLoadError, setTailorLoadError] = useState("");
  const popoverRef = useRef(null);
  const urlHydrated = useRef(false);

  useEffect(() => {
    document.title = "Browse Tailors | SewServe";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { tailors, ok } = await fetchPublicTailors();
      if (cancelled) return;
      if (ok && Array.isArray(tailors)) {
        setTailorDataset(tailors);
        setTailorLoadError("");
        return;
      }
      setTailorDataset([]);
      setTailorLoadError("Could not load tailors right now. Please try again.");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate filter state from the URL once, then keep the query string in sync with filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams is read only on first run; adding it loops with setSearchParams.
  useEffect(() => {
    if (!urlHydrated.current) {
      urlHydrated.current = true;
      const q = searchParams.get("q");
      if (q) setSearch(q);
      const r = searchParams.get("rating");
      if (r && ["any", "4", "4.5"].includes(r)) setRating(r);
      const pr = searchParams.get("price");
      if (pr && ["any", "low", "mid", "high"].includes(pr)) setPrice(pr);
      const d = searchParams.get("delivery");
      if (d && ["any", "fast", "standard", "flex"].includes(d)) setDelivery(d);
      const s = searchParams.get("sort");
      if (s && ["rating", "price-asc", "price-desc", "orders"].includes(s)) setSortBy(s);
      const ex = searchParams.get("exp");
      if (ex && ["any", "5", "10"].includes(ex)) setExperienceBar(ex);
      const cats = searchParams.get("cats");
      if (cats) setCategoryUi(categorySetFromParam(cats));
      return;
    }
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (rating !== "any") p.set("rating", rating);
    if (price !== "any") p.set("price", price);
    if (delivery !== "any") p.set("delivery", delivery);
    if (sortBy !== "rating") p.set("sort", sortBy);
    if (experienceBar !== "any") p.set("exp", experienceBar);
    const cp = categoryParamFromSet(categoryUi);
    if (cp) p.set("cats", cp);
    setSearchParams(p, { replace: true });
  }, [search, rating, price, delivery, sortBy, experienceBar, categoryUi, setSearchParams]);

  useEffect(() => {
    const sectionId = location.state?.scrollTo;
    if (!sectionId) return;
    const section = document.getElementById(sectionId);
    if (section) {
      setTimeout(() => section.scrollIntoView({ behavior: "smooth" }), 0);
    }
  }, [location.state]);

  useEffect(() => {
    function onPointerDown(e) {
      if (!filterMenu) return;
      const el = popoverRef.current;
      if (el && !el.contains(e.target)) setFilterMenu(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [filterMenu]);

  const handleSectionNavigate = (sectionId) => {
    if (location.pathname === "/") {
      const section = document.getElementById(sectionId);
      if (section) section.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate("/", { state: { scrollTo: sectionId } });
  };

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setRating("any");
    setPrice("any");
    setDelivery("any");
    setExperienceBar("any");
    setCategoryUi(new Set());
    setSortBy("rating");
    setFilterMenu(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(search.trim()) ||
      rating !== "any" ||
      price !== "any" ||
      delivery !== "any" ||
      experienceBar !== "any" ||
      sortBy !== "rating" ||
      categoryUi.size > 0,
    [search, rating, price, delivery, experienceBar, sortBy, categoryUi]
  );

  const filtered = useMemo(
    () =>
      tailorDataset.filter((t) =>
        matchesFilters(t, { search, rating, price, delivery, experienceBar, categoryUi })
      ),
    [tailorDataset, search, rating, price, delivery, experienceBar, categoryUi]
  );

  const sortedTailors = useMemo(() => {
    const list = filtered.slice();
    if (sortBy === "rating") list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "price-asc") list.sort((a, b) => a.priceStart - b.priceStart);
    else if (sortBy === "price-desc") list.sort((a, b) => b.priceStart - a.priceStart);
    else if (sortBy === "orders") list.sort((a, b) => b.experienceYears - a.experienceYears);
    return list;
  }, [filtered, sortBy]);

  const toggleCategory = (label) => {
    setCategoryUi((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const ratingSliderIdx = ratingToSliderIndex(rating);
  const priceSliderIdx = priceToSliderIndex(price);
  const starsPlusChecked = rating === "4" || rating === "4.5";

  const openMenu = (key) => {
    setFilterMenu((prev) => (prev === key ? null : key));
  };

  const scrollToSidebar = () => {
    document.getElementById("browse-sidebar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFilterMenu(null);
  };

  const menuPanelClass =
    "absolute left-1/2 top-[calc(100%+0.5rem)] z-30 min-w-[220px] -translate-x-1/2 rounded-2xl border border-white/40 bg-white/95 p-2 shadow-xl backdrop-blur-lg";

  return (
    <div className="relative isolate min-h-screen bg-transparent text-slate-600 antialiased">
      <LandingStylePageBackground />

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
.ss-glass-surface {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(15, 23, 42, 0.04);
}
`}
      </style>

      <div className="relative z-10 font-['Inter',sans-serif]">
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
        />

        <main id="home" className="relative">
          <div className="relative isolate overflow-hidden border-b border-white/25 bg-white/[0.06] backdrop-blur-xl">
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

            <section className="relative z-10 mx-auto max-w-7xl px-6 py-16 text-center sm:px-8 lg:px-10 lg:py-20">
            <h1 className="font-['Playfair_Display',Georgia,serif] text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
              <span className="bg-gradient-to-b from-[#070b14] to-[#1e293b] bg-clip-text text-transparent">
                Find Your Perfect Tailor
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Browse trusted professionals, compare ratings, and book directly through SewServe.
            </p>

            <div className="mx-auto mt-10 max-w-2xl">
              <label className="relative block">
                <span className="sr-only">Search tailors</span>
                <Search
                  className="pointer-events-none absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600/80"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, city, or specialty"
                  className="w-full rounded-full border border-gray-200/90 bg-white/80 py-4 pl-16 pr-6 text-base font-medium text-slate-900 shadow-lg backdrop-blur-md transition-all duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 focus:ring-offset-2 focus:ring-offset-white/50"
                />
              </label>
            </div>

            <div ref={popoverRef} className="relative mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2 sm:gap-3">
              <div className="relative">
                <button
                  type="button"
                  className={dropdownPill}
                  onClick={() => openMenu("rating")}
                  aria-expanded={filterMenu === "rating"}
                  aria-controls="browse-filter-rating-menu"
                  id="browse-filter-rating-trigger"
                >
                  {quickLabelRating(rating)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
                {filterMenu === "rating" && (
                  <div id="browse-filter-rating-menu" className={menuPanelClass} role="listbox" aria-labelledby="browse-filter-rating-trigger">
                    {RATING_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setRating(o.value);
                          setFilterMenu(null);
                        }}
                        className={`flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-300 hover:bg-emerald-50 ${
                          rating === o.value ? "bg-emerald-100 text-emerald-900" : "text-gray-800"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={dropdownPill}
                  onClick={() => openMenu("experience")}
                  aria-expanded={filterMenu === "experience"}
                  aria-controls="browse-filter-experience-menu"
                  id="browse-filter-experience-trigger"
                >
                  {quickLabelExperience(experienceBar)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
                {filterMenu === "experience" && (
                  <div id="browse-filter-experience-menu" className={menuPanelClass} aria-labelledby="browse-filter-experience-trigger">
                    {EXPERIENCE_BAR_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setExperienceBar(o.value);
                          setFilterMenu(null);
                        }}
                        className={`flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-300 hover:bg-emerald-50 ${
                          experienceBar === o.value ? "bg-emerald-100 text-emerald-900" : "text-gray-800"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={dropdownPill}
                  onClick={() => openMenu("price")}
                  aria-expanded={filterMenu === "price"}
                  aria-controls="browse-filter-price-menu"
                  id="browse-filter-price-trigger"
                >
                  {quickLabelPrice(price)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
                {filterMenu === "price" && (
                  <div id="browse-filter-price-menu" className={menuPanelClass} aria-labelledby="browse-filter-price-trigger">
                    {PRICE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setPrice(o.value);
                          setFilterMenu(null);
                        }}
                        className={`flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-300 hover:bg-emerald-50 ${
                          price === o.value ? "bg-emerald-100 text-emerald-900" : "text-gray-800"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={dropdownPill}
                  onClick={() => openMenu("delivery")}
                  aria-expanded={filterMenu === "delivery"}
                  aria-controls="browse-filter-delivery-menu"
                  id="browse-filter-delivery-trigger"
                >
                  {quickLabelDelivery(delivery)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
                {filterMenu === "delivery" && (
                  <div id="browse-filter-delivery-menu" className={menuPanelClass} aria-labelledby="browse-filter-delivery-trigger">
                    {DELIVERY_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setDelivery(o.value);
                          setFilterMenu(null);
                        }}
                        className={`flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-300 hover:bg-emerald-50 ${
                          delivery === o.value ? "bg-emerald-100 text-emerald-900" : "text-gray-800"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className={dropdownPill} onClick={scrollToSidebar}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Filter
              </button>
            </div>
            </section>
          </div>

          <section className="mx-auto max-w-7xl px-6 pb-12 sm:px-8 lg:px-10 lg:pb-16">
            <div className="mb-8 text-sm font-medium text-slate-600">
              Showing <span className="font-bold text-slate-900">{sortedTailors.length}</span> tailor
              {sortedTailors.length !== 1 ? "s" : ""}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              <aside id="browse-sidebar" className="order-1 lg:col-span-3">
                <div className="ss-glass-surface sticky top-24 rounded-2xl border border-white/40 p-6 shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-900/70">Filter Results</h2>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="shrink-0 text-xs font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-2 hover:text-emerald-950"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="mt-6 space-y-3 border-t border-emerald-900/10 pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
                    <ul className="space-y-2">
                      {CATEGORY_LABELS.map((cat) => (
                        <li key={cat}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 transition-all duration-300 hover:bg-emerald-50/80">
                            <input
                              type="checkbox"
                              checked={categoryUi.has(cat)}
                              onChange={() => toggleCategory(cat)}
                              className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium text-gray-800">{cat}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 space-y-3 border-t border-emerald-900/10 pt-6">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="browse-rating-slider">
                      Rating
                    </label>
                    <input
                      id="browse-rating-slider"
                      type="range"
                      min={0}
                      max={2}
                      step={1}
                      value={ratingSliderIdx}
                      onChange={(e) => setRating(sliderIndexToRating(Number(e.target.value)))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-200/90 accent-emerald-600 transition-all duration-300"
                    />
                    <label className="flex cursor-pointer items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={starsPlusChecked}
                        onChange={(e) => setRating(e.target.checked ? "4" : "any")}
                        className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-gray-700">4+ Stars &amp; Up</span>
                    </label>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-6">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="browse-delivery-select">
                      Delivery Time
                    </label>
                    <select
                      id="browse-delivery-select"
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                      className="w-full rounded-xl border border-gray-200/90 bg-white/95 py-2.5 pl-3 pr-8 text-sm font-medium text-gray-800 shadow-sm backdrop-blur-sm transition-all duration-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                    >
                      {DELIVERY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-6">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="browse-price-slider">
                      Price Range
                    </label>
                    <p className="text-xs font-medium text-emerald-800/80">PKR 1,000 – 5,000+ bands</p>
                    <input
                      id="browse-price-slider"
                      type="range"
                      min={0}
                      max={3}
                      step={1}
                      value={priceSliderIdx}
                      onChange={(e) => setPrice(sliderIndexToPrice(Number(e.target.value)))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-200/90 accent-emerald-600 transition-all duration-300"
                    />
                    <p className="text-xs text-gray-500">{PRICE_OPTIONS[priceSliderIdx]?.label}</p>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-6">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="browse-sort">
                      Sort By
                    </label>
                    <select
                      id="browse-sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-xl border border-gray-200/90 bg-white/95 py-2.5 pl-3 pr-8 text-sm font-medium text-gray-800 shadow-sm backdrop-blur-sm transition-all duration-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </aside>

              <div className="order-2 lg:col-span-9">
                <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                  {sortedTailors.map((tailor) => (
                    <li key={tailor.id} className="min-w-0">
                      <TailorCard
                        tailor={tailor}
                        onViewProfile={() => navigate(`/tailors/${tailor.id}`)}
                        onSendRequest={() => setRequestFor(tailor)}
                      />
                    </li>
                  ))}
                </ul>

                {sortedTailors.length === 0 && (
                  <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-gray-200/80 bg-white/70 px-6 py-16 text-center shadow-sm backdrop-blur-md">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
                      <Search className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                    </div>
                    <p className="text-lg font-semibold text-slate-900">No tailors found nearby</p>
                    <p className="mt-2 max-w-sm text-sm text-slate-600">
                      {tailorLoadError ? tailorLoadError : "Try adjusting your search or filters to see more results."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="mt-6 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 pb-24 sm:px-8 lg:px-10">
            <div className="ss-glass-surface grid grid-cols-1 items-center gap-10 rounded-2xl border border-white/40 p-8 shadow-lg transition-all duration-300 md:grid-cols-[minmax(0,280px)_1fr] md:gap-12 md:p-10 lg:p-12">
              <div
                className="mx-auto flex aspect-[4/3] w-full max-w-[280px] items-center justify-center rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-100/90 via-teal-50/80 to-white text-center text-sm font-medium leading-snug text-emerald-900/60 shadow-inner md:mx-0"
                aria-hidden="true"
              >
                Illustration — tailor at work
              </div>
              <div className="text-center md:text-left">
                <h2 className="font-['Playfair_Display',Georgia,serif] text-2xl font-bold text-emerald-950 sm:text-3xl">
                  Need Help Finding the Right Tailor?
                </h2>
                <p className="mt-3 max-w-xl text-base text-gray-600">
                  Our support team is here to assist you.
                </p>
                <button
                  type="button"
                  onClick={() => handleSectionNavigate("contact")}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-700 to-teal-700 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95"
                >
                  Contact Us
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <SendRequestModal open={Boolean(requestFor)} tailor={requestFor} onClose={() => setRequestFor(null)} />
    </div>
  );
}
