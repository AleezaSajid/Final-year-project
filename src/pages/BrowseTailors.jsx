import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  MapPin,
  MousePointerClick,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import "./browseTailors.css";
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
const TAILORS_PAGE_SIZE = 8;

const SUPPORT_BENEFITS = [
  { icon: BadgeCheck, label: "Verified Tailors" },
  { icon: MapPin, label: "Nearby Experts" },
  { icon: MousePointerClick, label: "Instant Requests" },
];

const HERO_STATS = ["500+ Tailors", "Verified Experts", "Fast Responses"];

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

function filterPillClass(isActive) {
  return `browse-filter-pill${isActive ? " browse-filter-pill--active" : ""}`;
}

function filterOptionClass(isSelected) {
  return `flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-300 hover:bg-emerald-50 ${
    isSelected ? "bg-emerald-100 text-emerald-900" : "text-gray-800"
  }`;
}

function BrowseSkeletonCard() {
  return (
    <li className="browse-skeleton-card" aria-hidden>
      <div className="browse-skeleton-media" />
      <div className="browse-skeleton-body">
        <div className="browse-skeleton-line browse-skeleton-line--mid" />
        <div className="browse-skeleton-line browse-skeleton-line--short" />
        <div className="browse-skeleton-line" />
        <div className="browse-skeleton-line browse-skeleton-line--short" />
      </div>
    </li>
  );
}

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
  const [tailorsLoading, setTailorsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(TAILORS_PAGE_SIZE);
  const popoverRef = useRef(null);
  const portalMenuRef = useRef(null);
  const filterTriggerRefs = useRef({
    rating: null,
    experience: null,
    price: null,
    delivery: null,
  });
  const [menuPosition, setMenuPosition] = useState(null);
  const urlHydrated = useRef(false);
  const skipUrlSyncRef = useRef(true);

  useEffect(() => {
    document.title = "Browse Tailors | SewServe";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTailorsLoading(true);
      const { tailors, ok } = await fetchPublicTailors();
      if (cancelled) return;
      if (ok && Array.isArray(tailors)) {
        setTailorDataset(tailors);
        setTailorLoadError("");
      } else {
        setTailorDataset([]);
        setTailorLoadError("Could not load tailors right now. Please try again.");
      }
      setTailorsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate filter state from the URL once.
  useEffect(() => {
    if (urlHydrated.current) return;
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
  }, [searchParams]);

  // Keep the query string in sync with filters after initial hydration (skip first pass).
  useEffect(() => {
    if (!urlHydrated.current) return;
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
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
      const target = e.target;
      if (popoverRef.current?.contains(target)) return;
      if (portalMenuRef.current?.contains(target)) return;
      setFilterMenu(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [filterMenu]);

  useEffect(() => {
    if (!filterMenu) {
      setMenuPosition(null);
      return undefined;
    }
    const updatePosition = () => {
      const trigger = filterTriggerRefs.current[filterMenu];
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
        minWidth: Math.max(220, rect.width),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
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

  const categoryFilterKey = categoryParamFromSet(categoryUi);

  useEffect(() => {
    setVisibleCount(TAILORS_PAGE_SIZE);
  }, [search, rating, price, delivery, experienceBar, sortBy, categoryFilterKey]);

  const visibleTailors = useMemo(
    () => sortedTailors.slice(0, visibleCount),
    [sortedTailors, visibleCount]
  );

  const totalTailors = sortedTailors.length;
  const shownEnd = totalTailors === 0 ? 0 : Math.min(visibleCount, totalTailors);
  const canLoadMore = !tailorsLoading && totalTailors > visibleCount;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + TAILORS_PAGE_SIZE, sortedTailors.length));
  }, [sortedTailors.length]);

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

  const locationLabel = useMemo(() => {
    const fromState = location.state?.locationLabel || location.state?.areaLabel || location.state?.city;
    if (typeof fromState === "string" && fromState.trim()) return fromState.trim();
    return "";
  }, [location.state]);

  const openMenu = (key) => {
    setFilterMenu((prev) => (prev === key ? null : key));
  };

  const scrollToSidebar = () => {
    document.getElementById("browse-sidebar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFilterMenu(null);
  };

  const filterMenuPortal =
    filterMenu && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={portalMenuRef}
            id={`browse-filter-${filterMenu}-menu`}
            className="browse-filter-dropdown-menu browse-filter-dropdown-menu--portal"
            role="listbox"
            aria-labelledby={`browse-filter-${filterMenu}-trigger`}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.minWidth,
            }}
          >
            {filterMenu === "rating"
              ? RATING_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={rating === o.value}
                    onClick={() => {
                      setRating(o.value);
                      setFilterMenu(null);
                    }}
                    className={filterOptionClass(rating === o.value)}
                  >
                    {o.label}
                  </button>
                ))
              : null}
            {filterMenu === "experience"
              ? EXPERIENCE_BAR_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={experienceBar === o.value}
                    onClick={() => {
                      setExperienceBar(o.value);
                      setFilterMenu(null);
                    }}
                    className={filterOptionClass(experienceBar === o.value)}
                  >
                    {o.label}
                  </button>
                ))
              : null}
            {filterMenu === "price"
              ? PRICE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={price === o.value}
                    onClick={() => {
                      setPrice(o.value);
                      setFilterMenu(null);
                    }}
                    className={filterOptionClass(price === o.value)}
                  >
                    {o.label}
                  </button>
                ))
              : null}
            {filterMenu === "delivery"
              ? DELIVERY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={delivery === o.value}
                    onClick={() => {
                      setDelivery(o.value);
                      setFilterMenu(null);
                    }}
                    className={filterOptionClass(delivery === o.value)}
                  >
                    {o.label}
                  </button>
                ))
              : null}
          </div>,
          document.body
        )
      : null;

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
        {filterMenuPortal}
        <LandingNavbar
          logoDisplaySrc={logoDisplaySrc}
          navLinks={navLinks}
          onSectionNavigate={handleSectionNavigate}
        />

        <main id="home" className="relative">
          <div className="browse-hero-shell relative isolate overflow-visible border-b border-white/25">
            <div className="browse-hero-grid" aria-hidden="true" />
            <div
              className="browse-hero-glow browse-hero-glow--mint pointer-events-none absolute -left-24 top-0 h-[min(18rem,70vw)] w-[min(18rem,70vw)] rounded-full"
              aria-hidden="true"
            />
            <div
              className="browse-hero-glow browse-hero-glow--blue pointer-events-none absolute -right-24 top-2 h-[min(16rem,65vw)] w-[min(16rem,65vw)] rounded-full"
              aria-hidden="true"
            />
            <div
              className="browse-hero-glow browse-hero-glow--violet pointer-events-none absolute bottom-0 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full"
              aria-hidden="true"
            />

            <section className="browse-hero-section relative z-10 mx-auto max-w-7xl px-6 text-center sm:px-8 lg:px-10">
              <h1 className="browse-hero-title text-3xl sm:text-4xl lg:text-[2.65rem]">
                Find Tailors Near You
              </h1>
              <p className="browse-hero-subtitle mx-auto mt-2.5 max-w-xl text-sm sm:text-base">
                Browse verified local tailors, compare styles, and send your request.
              </p>

              <ul className="browse-hero-stats" aria-label="Platform highlights">
                {HERO_STATS.map((stat) => (
                  <li key={stat}>
                    <span className="browse-hero-stat-pill">{stat}</span>
                  </li>
                ))}
              </ul>

              {locationLabel ? (
                <p className="browse-location-pill browse-location-pill--hero" role="status">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Showing tailors near {locationLabel}
                </p>
              ) : null}

              <div className="browse-search-panel">
                <div className="browse-search-wrap">
                  <label className="relative block">
                    <span className="sr-only">Search tailors</span>
                    <Search className="browse-search-icon" aria-hidden />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, city, or specialty"
                      className="browse-search-input"
                    />
                  </label>
                </div>

                <div ref={popoverRef} className="browse-hero-filters relative flex flex-wrap justify-center gap-2">
              <div className="browse-filter-dropdown-wrap">
                <button
                  ref={(el) => {
                    filterTriggerRefs.current.rating = el;
                  }}
                  type="button"
                  className={filterPillClass(rating !== "any")}
                  onClick={() => openMenu("rating")}
                  aria-expanded={filterMenu === "rating"}
                  aria-controls="browse-filter-rating-menu"
                  id="browse-filter-rating-trigger"
                >
                  {quickLabelRating(rating)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
              </div>
              <div className="browse-filter-dropdown-wrap">
                <button
                  ref={(el) => {
                    filterTriggerRefs.current.experience = el;
                  }}
                  type="button"
                  className={filterPillClass(experienceBar !== "any")}
                  onClick={() => openMenu("experience")}
                  aria-expanded={filterMenu === "experience"}
                  aria-controls="browse-filter-experience-menu"
                  id="browse-filter-experience-trigger"
                >
                  {quickLabelExperience(experienceBar)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
              </div>
              <div className="browse-filter-dropdown-wrap">
                <button
                  ref={(el) => {
                    filterTriggerRefs.current.price = el;
                  }}
                  type="button"
                  className={filterPillClass(price !== "any")}
                  onClick={() => openMenu("price")}
                  aria-expanded={filterMenu === "price"}
                  aria-controls="browse-filter-price-menu"
                  id="browse-filter-price-trigger"
                >
                  {quickLabelPrice(price)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
              </div>
              <div className="browse-filter-dropdown-wrap">
                <button
                  ref={(el) => {
                    filterTriggerRefs.current.delivery = el;
                  }}
                  type="button"
                  className={filterPillClass(delivery !== "any")}
                  onClick={() => openMenu("delivery")}
                  aria-expanded={filterMenu === "delivery"}
                  aria-controls="browse-filter-delivery-menu"
                  id="browse-filter-delivery-trigger"
                >
                  {quickLabelDelivery(delivery)}
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className={filterPillClass(categoryUi.size > 0 || sortBy !== "rating")}
                onClick={scrollToSidebar}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Filter
              </button>
                </div>
              </div>
            </section>
          </div>

          <section className="browse-catalog-section mx-auto max-w-7xl px-6 pb-12 sm:px-8 lg:px-10 lg:pb-16">
            <p className="browse-results-count mb-6" role="status" aria-live="polite">
              {tailorsLoading ? (
                <>Loading tailors…</>
              ) : totalTailors === 0 ? (
                <>Showing <strong>0</strong> tailors</>
              ) : (
                <>
                  Showing <strong>1–{shownEnd}</strong> of <strong>{totalTailors}</strong> tailor
                  {totalTailors !== 1 ? "s" : ""}
                </>
              )}
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
              <aside id="browse-sidebar" className="order-1 lg:col-span-3">
                <div className="browse-sidebar-card">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="browse-sidebar-heading">Filter Results</h2>
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
                    <p className="browse-sidebar-section-title">Category</p>
                    <ul className="space-y-2">
                      {CATEGORY_LABELS.map((cat) => (
                        <li key={cat}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 transition-all duration-300 hover:bg-emerald-50/80">
                            <input
                              type="checkbox"
                              checked={categoryUi.has(cat)}
                              onChange={() => toggleCategory(cat)}
                              className="browse-sidebar-check h-4 w-4 rounded border-emerald-300"
                            />
                            <span className="text-sm font-medium text-gray-800">{cat}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 space-y-3 border-t border-emerald-900/10 pt-6">
                    <label className="browse-sidebar-section-title" htmlFor="browse-rating-slider">
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
                      className="browse-sidebar-range w-full cursor-pointer appearance-none"
                    />
                    <label className="flex cursor-pointer items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={starsPlusChecked}
                        onChange={(e) => setRating(e.target.checked ? "4" : "any")}
                        className="browse-sidebar-check h-4 w-4 rounded border-emerald-300"
                      />
                      <span className="text-sm font-medium text-gray-700">4+ Stars &amp; Up</span>
                    </label>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-6">
                    <label className="browse-sidebar-section-title" htmlFor="browse-delivery-select">
                      Delivery Time
                    </label>
                    <select
                      id="browse-delivery-select"
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                      className="browse-sidebar-select"
                    >
                      {DELIVERY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-6">
                    <label className="browse-sidebar-section-title" htmlFor="browse-price-slider">
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
                      className="browse-sidebar-range w-full cursor-pointer appearance-none"
                    />
                    <p className="text-xs text-gray-500">{PRICE_OPTIONS[priceSliderIdx]?.label}</p>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-6">
                    <label className="browse-sidebar-section-title" htmlFor="browse-sort">
                      Sort By
                    </label>
                    <select
                      id="browse-sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="browse-sidebar-select"
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
                <ul className="browse-grid">
                  {tailorsLoading
                    ? Array.from({ length: 4 }, (_, i) => <BrowseSkeletonCard key={`sk-${i}`} />)
                    : visibleTailors.map((tailor) => (
                        <li key={tailor.id} className="min-w-0">
                          <TailorCard
                            tailor={tailor}
                            onViewProfile={() => navigate(`/tailors/${tailor.id}`)}
                            onSendRequest={() => setRequestFor(tailor)}
                          />
                        </li>
                      ))}
                </ul>

                {!tailorsLoading && totalTailors > 0 && (
                  <div className="browse-load-more-wrap">
                    {canLoadMore ? (
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        className="browse-load-more-btn"
                      >
                        Load More Tailors
                      </button>
                    ) : (
                      <p className="browse-load-more-done">All tailors loaded.</p>
                    )}
                  </div>
                )}

                {!tailorsLoading && totalTailors === 0 && (
                  <div className="browse-empty-state mt-4">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-100">
                      <Search className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                    </div>
                    <p className="text-lg font-semibold text-[#0f172a]">No tailors found nearby</p>
                    <p className="mt-2 max-w-sm text-sm text-slate-600">
                      {tailorLoadError ? tailorLoadError : "Try adjusting your search or filters to see more results."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="mt-6 rounded-full border border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-white px-5 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="browse-support-section mx-auto max-w-7xl px-6 pb-12 sm:px-8 lg:px-10">
            <div className="browse-support-card ss-glass-surface">
              <div className="browse-support-header">
                <div className="browse-support-copy">
                  <h2 className="browse-support-title">
                    Need Help Finding the Right Tailor?
                  </h2>
                  <p className="browse-support-subtitle">
                    Our support team is here to assist you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSectionNavigate("contact")}
                  className="browse-support-cta"
                >
                  Contact Us
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
              <ul className="browse-support-pills" aria-label="Why use SewServe">
                {SUPPORT_BENEFITS.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <span className="browse-support-pill">
                      <span className="browse-support-pill-icon" aria-hidden>
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                      <span className="browse-support-pill-label">{label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>

      <SendRequestModal open={Boolean(requestFor)} tailor={requestFor} onClose={() => setRequestFor(null)} />
    </div>
  );
}
