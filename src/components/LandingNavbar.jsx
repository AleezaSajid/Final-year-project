import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Scissors, User, X } from "lucide-react";

const DEFAULT_NAV_LINKS = [
  { label: "Home", sectionId: "home" },
  { label: "About", sectionId: "about" },
  { label: "Services", sectionId: "how-it-works" },
  { label: "Contact", sectionId: "contact" },
];

/**
 * Public marketing site header (home page): glass nav with login role dropdown.
 */
export default function LandingNavbar({
  logoDisplaySrc,
  navLinks = DEFAULT_NAV_LINKS,
  onSectionNavigate,
  onDashboardNavigate,
  /** When true, "Track Orders" sits in the center nav after Dashboard (customer dashboard mock). */
  trackOrdersInNavCenter = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDashboardActive = ["/customer/dashboard", "/tailor/dashboard", "/dashboard"].includes(location.pathname);
  const isTrackOrdersActive = location.pathname === "/orders";
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const loginDropdownRef = useRef(null);
  const navRef = useRef(null);
  const itemRefs = useRef({});
  const hoverKeyRef = useRef(null);
  /** Sliding underline: x/w relative to nav box; opacity 0 when idle with no active route */
  const [underline, setUnderline] = useState({ x: 0, w: 0, opacity: 0 });

  const measureItem = useCallback((key) => {
    const nav = navRef.current;
    const el = itemRefs.current[key];
    if (!nav || !el) return null;
    const er = el.getBoundingClientRect();
    if (er.width === 0 && er.height === 0) return null;
    const nr = nav.getBoundingClientRect();
    return { x: er.left - nr.left, w: er.width };
  }, []);

  const applyRestFromActiveRoute = useCallback(() => {
    if (isDashboardActive && itemRefs.current.dashboard) {
      return measureItem("dashboard");
    }
    if (isTrackOrdersActive && itemRefs.current.track) {
      return measureItem("track");
    }
    return null;
  }, [isDashboardActive, isTrackOrdersActive, measureItem]);

  const syncUnderline = useCallback(() => {
    const key = hoverKeyRef.current;
    if (key) {
      const m = measureItem(key);
      if (m) setUnderline({ x: m.x, w: m.w, opacity: 1 });
      else setUnderline((u) => ({ ...u, opacity: 0 }));
      return;
    }
    const rest = applyRestFromActiveRoute();
    if (rest) setUnderline({ x: rest.x, w: rest.w, opacity: 1 });
    else setUnderline((u) => ({ ...u, opacity: 0 }));
  }, [applyRestFromActiveRoute, measureItem]);

  useLayoutEffect(() => {
    syncUnderline();
  }, [
    syncUnderline,
    location.pathname,
    trackOrdersInNavCenter,
    navLinks,
    mobileOpen,
  ]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      syncUnderline();
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [syncUnderline]);

  useEffect(() => {
    function onWinResize() {
      syncUnderline();
    }
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, [syncUnderline]);

  const setItemRef = useCallback((key) => {
    return (el) => {
      if (el) itemRefs.current[key] = el;
      else delete itemRefs.current[key];
    };
  }, []);

  const onNavItemEnter = useCallback(
    (key) => {
      hoverKeyRef.current = key;
      const m = measureItem(key);
      if (m) setUnderline({ x: m.x, w: m.w, opacity: 1 });
    },
    [measureItem]
  );

  const onNavPointerLeave = useCallback(() => {
    hoverKeyRef.current = null;
    const rest = applyRestFromActiveRoute();
    if (rest) setUnderline({ x: rest.x, w: rest.w, opacity: 1 });
    else setUnderline((u) => ({ ...u, opacity: 0 }));
  }, [applyRestFromActiveRoute]);

  const onNavItemFocus = useCallback(
    (key) => {
      hoverKeyRef.current = key;
      const m = measureItem(key);
      if (m) setUnderline({ x: m.x, w: m.w, opacity: 1 });
    },
    [measureItem]
  );

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    function onFocusOut(event) {
      const next = event.relatedTarget;
      const refs = itemRefs.current;
      const isTracked = (node) =>
        node && Object.keys(refs).some((k) => refs[k] === node);
      if (next && isTracked(next)) return;
      hoverKeyRef.current = null;
      const rest = applyRestFromActiveRoute();
      if (rest) setUnderline({ x: rest.x, w: rest.w, opacity: 1 });
      else setUnderline((u) => ({ ...u, opacity: 0 }));
    }
    nav.addEventListener("focusout", onFocusOut);
    return () => nav.removeEventListener("focusout", onFocusOut);
  }, [applyRestFromActiveRoute]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!loginDropdownRef.current?.contains(event.target)) {
        setLoginMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const handleCloseMobileMenu = () => setMobileOpen(false);

  const goCustomerLogin = () => {
    navigate("/login");
    setLoginMenuOpen(false);
    handleCloseMobileMenu();
  };

  const goTailorLogin = () => {
    navigate("/tailor-login");
    setLoginMenuOpen(false);
    handleCloseMobileMenu();
  };

  return (
    <header className="ss-glass-surface sticky top-0 z-50 border-b border-white/35 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08)]">
      <style>
        {`
          /* Shared nav text styles (underline is one sliding element in nav) */
          .ss-landing-nav-link {
            transition: color 0.2s ease;
          }
          .ss-landing-nav-link:hover {
            color: #4a7c59 !important;
          }
          .ss-landing-nav-link:focus-visible {
            color: #4a7c59 !important;
            outline: none;
          }
          .ss-landing-nav-link--active {
            color: #166534 !important;
          }
          .ss-landing-nav-link--active:hover {
            color: #4a7c59 !important;
          }
        `}
      </style>
      <nav
        ref={navRef}
        className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8"
        onMouseLeave={onNavPointerLeave}
      >
        {/* Single sliding underline (md+); positioned at bottom of nav — transform + width */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 z-0 hidden h-0.5 rounded-full md:block"
          style={{
            width: Math.max(0, underline.w),
            opacity: underline.opacity,
            transform: `translateX(${underline.x}px)`,
            transition:
              "transform 300ms ease, width 300ms ease, opacity 200ms ease",
            background: "linear-gradient(90deg, #3d6b4a, #4a7c59)",
            willChange: "transform, width",
          }}
          aria-hidden
        />
        {/* Home (`/`): keep anchor to #home like original landing. Other routes: Link back to marketing home. */}
        {location.pathname === "/" ? (
          <a
            href="#home"
            className="inline-flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
            onClick={handleCloseMobileMenu}
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
        ) : (
          <Link
            to="/"
            className="inline-flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
            onClick={handleCloseMobileMenu}
            aria-label="SewServe — home"
          >
            <img
              src={logoDisplaySrc}
              alt=""
              width={180}
              height={44}
              className="block h-9 max-h-[44px] w-auto object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition-[filter,transform] duration-[250ms] ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
            />
          </Link>
        )}

        <div className="relative z-10 hidden flex-1 items-center justify-center gap-4 md:flex md:gap-5">
          {navLinks.map((link) => (
            <button
              key={link.label}
              ref={setItemRef(`section-${link.sectionId}`)}
              type="button"
              onClick={() => onSectionNavigate(link.sectionId)}
              onMouseEnter={() => onNavItemEnter(`section-${link.sectionId}`)}
              onFocus={() => onNavItemFocus(`section-${link.sectionId}`)}
              className="ss-landing-nav-link px-3 py-2 text-sm font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
            >
              {link.label}
            </button>
          ))}
          <button
            ref={setItemRef("dashboard")}
            type="button"
            onClick={onDashboardNavigate}
            onMouseEnter={() => onNavItemEnter("dashboard")}
            onFocus={() => onNavItemFocus("dashboard")}
            className={`ss-landing-nav-link px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 ${
              isDashboardActive ? "ss-landing-nav-link--active" : "text-slate-600"
            }`}
            aria-current={isDashboardActive ? "page" : undefined}
          >
            Dashboard
          </button>
          {trackOrdersInNavCenter && (
            <button
              ref={setItemRef("track")}
              type="button"
              onClick={() => navigate("/orders")}
              aria-label="Track orders"
              onMouseEnter={() => onNavItemEnter("track")}
              onFocus={() => onNavItemFocus("track")}
              className={`ss-landing-nav-link px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 ${
                isTrackOrdersActive ? "ss-landing-nav-link--active" : "text-slate-600"
              }`}
              aria-current={isTrackOrdersActive ? "page" : undefined}
            >
              Track Orders
            </button>
          )}
        </div>

        <div className="relative z-10 hidden items-center gap-4 md:flex">
          {!trackOrdersInNavCenter && (
            <button
              ref={setItemRef("track")}
              type="button"
              onClick={() => navigate("/orders")}
              aria-label="Track orders"
              onMouseEnter={() => onNavItemEnter("track")}
              onFocus={() => onNavItemFocus("track")}
              className={`ss-landing-nav-link px-3 py-2 text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 ${
                isTrackOrdersActive ? "ss-landing-nav-link--active" : "text-slate-500"
              }`}
              aria-current={isTrackOrdersActive ? "page" : undefined}
            >
              Track Orders
            </button>
          )}

          <div className="relative" ref={loginDropdownRef}>
            <button
              type="button"
              onClick={() => setLoginMenuOpen((open) => !open)}
              aria-expanded={loginMenuOpen}
              aria-haspopup="menu"
              aria-controls="landing-login-menu"
              id="landing-login-trigger"
              className="group/login-trigger inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-slate-800 transition-all duration-200 ease-out hover:text-slate-950 hover:underline hover:decoration-slate-400/80 hover:underline-offset-[5px] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
            >
              Login
              <ChevronDown
                aria-hidden
                className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ease-out group-hover/login-trigger:text-slate-700 ${
                  loginMenuOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2.25}
              />
            </button>
            <div
              id="landing-login-menu"
              role="menu"
              aria-labelledby="landing-login-trigger"
              className={`absolute right-0 top-full z-[60] mt-2 flex min-w-[180px] flex-col gap-1 rounded-[13px] bg-white/90 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-[10px] transition-[opacity,transform] duration-200 ease-out ${
                loginMenuOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              <button
                type="button"
                role="menuitem"
                onClick={goCustomerLogin}
                className="flex w-full items-center gap-2.5 rounded-lg px-[14px] py-[10px] text-left text-sm font-semibold text-[#1a1a1a] transition-all duration-200 ease-out hover:scale-[1.01] hover:bg-[#f5f5f7] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/20 focus-visible:ring-offset-1"
              >
                <User size={16} strokeWidth={2} className="shrink-0 text-current" aria-hidden />
                <span>Customer Login</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={goTailorLogin}
                className="flex w-full items-center gap-2.5 rounded-lg px-[14px] py-[10px] text-left text-sm font-semibold text-[#1a1a1a] transition-all duration-200 ease-out hover:scale-[1.01] hover:bg-[#f5f5f7] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/20 focus-visible:ring-offset-1"
              >
                <Scissors size={16} strokeWidth={2} className="shrink-0 text-current" aria-hidden />
                <span>Tailor Login</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate("/signup")}
            type="button"
            aria-label="Get started — sign up"
            className="rounded-apple bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] px-[18px] py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
          >
            Get Started
          </button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-white/15 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-controls="mobile-menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="ss-glass-surface border-t border-white/25 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => {
                  handleCloseMobileMenu();
                  onSectionNavigate(link.sectionId);
                }}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/15 hover:text-[#4a7c59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
              >
                {link.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                handleCloseMobileMenu();
                onDashboardNavigate();
              }}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/15 hover:text-[#4a7c59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 ${
                isDashboardActive ? "bg-white/20 font-semibold text-emerald-900" : "text-slate-600"
              }`}
              aria-current={isDashboardActive ? "page" : undefined}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                navigate("/orders");
                handleCloseMobileMenu();
              }}
              aria-label="Track orders from mobile menu"
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/15 hover:text-[#4a7c59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 ${
                trackOrdersInNavCenter && isTrackOrdersActive ? "bg-white/20 font-semibold text-emerald-900" : "text-slate-600"
              }`}
              aria-current={isTrackOrdersActive ? "page" : undefined}
            >
              Track Orders
            </button>
            <button
              type="button"
              onClick={() => {
                goCustomerLogin();
              }}
              aria-label="Customer login from mobile menu"
              className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
            >
              Customer Login
            </button>
            <button
              type="button"
              onClick={() => {
                goTailorLogin();
              }}
              aria-label="Tailor login from mobile menu"
              className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2"
            >
              Tailor Login
            </button>
            <button
              type="button"
              onClick={() => {
                navigate("/signup");
                handleCloseMobileMenu();
              }}
              aria-label="Get started from mobile menu"
              className="mt-1 inline-flex w-full items-center justify-center rounded-apple bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] px-[18px] py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
