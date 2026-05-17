import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  X,
} from "lucide-react";
import { SewServeBrandImg } from "../../components/SewServeBrandImg.jsx";
import { clearUserRole } from "../../utils/userRole.js";
import { TAILOR_SESSION_STORAGE_KEY } from "../../utils/chatIdentity.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  TD_SIDEBAR_NAV_ACTIVE,
  TD_SIDEBAR_NAV_BASE,
  TD_SIDEBAR_NAV_IDLE,
  TD_SIDEBAR_SURFACE_STYLE,
} from "../tailorDashboardClassNames.js";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/tailor/dashboard",
    match: (path) => path === "/tailor/dashboard" || path === "/tailor-dashboard",
  },
  {
    id: "orders",
    label: "Orders",
    icon: ClipboardList,
    to: "/tailor/orders",
    match: (path) => path === "/tailor/orders",
  },
  {
    id: "messages",
    label: "Messages",
    icon: MessageCircle,
    to: "/tailor/messages",
    match: (path) => path === "/tailor/messages",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    scrollTarget: "td-upcoming",
    match: (path) => path === "/tailor/dashboard" && false,
  },
];

function NavLinkContent({ item, active, badge }) {
  const Icon = item.icon;
  return (
    <>
      <Icon className="h-4 w-4 shrink-0 text-[#2f6f56]" strokeWidth={2} aria-hidden />
      <span className="flex-1 text-left text-[#183b2d]">{item.label}</span>
      {badge > 0 ? (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#2e7d5a] px-1.5 text-[10px] font-bold text-white shadow-sm">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#2e7d5a]"
          aria-hidden
        />
      ) : null}
    </>
  );
}

function SidebarNav({ pathname, unreadChatCount, onNavigate }) {
  const navigate = useNavigate();

  const handleCalendar = () => {
    onNavigate?.();
    if (pathname === "/tailor/dashboard" || pathname === "/tailor-dashboard") {
      document.getElementById("td-upcoming")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/tailor/dashboard");
    window.setTimeout(() => {
      document.getElementById("td-upcoming")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 320);
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 py-1.5" aria-label="Tailor dashboard">
      {NAV_ITEMS.map((item) => {
        const active = item.match?.(pathname) ?? false;
        const stateClass = active ? TD_SIDEBAR_NAV_ACTIVE : TD_SIDEBAR_NAV_IDLE;

        if (item.scrollTarget) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={handleCalendar}
              className={`${TD_SIDEBAR_NAV_BASE} ${stateClass}`}
            >
              <NavLinkContent item={item} active={false} badge={0} />
            </button>
          );
        }

        const badge = item.id === "messages" ? unreadChatCount : 0;

        return (
          <Link
            key={item.id}
            to={item.to}
            onClick={onNavigate}
            className={`${TD_SIDEBAR_NAV_BASE} ${stateClass}`}
            aria-current={active ? "page" : undefined}
          >
            <NavLinkContent item={item} active={active} badge={badge} />
          </Link>
        );
      })}
    </nav>
  );
}

export default function TailorDashboardSidebar({ unreadChatCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = location.pathname;

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    localStorage.removeItem("sewserve_auth_token");
    sessionStorage.removeItem("sewserve_auth_token");
    localStorage.removeItem("currentUser");
    try {
      localStorage.removeItem(TAILOR_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearUserRole();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    navigate("/");
    closeMobile();
  };

  const sidebarInner = (
    <>
      <div className="border-b border-[rgba(46,125,90,0.08)] px-3 pb-3 pt-4">
        <Link to="/" className="inline-flex flex-col gap-0.5" onClick={closeMobile}>
          <SewServeBrandImg className="h-7 max-w-[118px]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a7a6d]">
            Tailor Studio
          </span>
        </Link>
      </div>

      <SidebarNav
        pathname={pathname}
        unreadChatCount={unreadChatCount}
        onNavigate={closeMobile}
      />

      <div className="mt-auto border-t border-[rgba(46,125,90,0.08)] p-2">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-transparent px-3 py-2 text-[13px] font-semibold text-[#5a7a6d] transition-all duration-200 ease-out hover:bg-red-50/80 hover:text-red-700"
        >
          <LogOut className="h-4 w-4 text-[#2f6f56]" strokeWidth={2} aria-hidden />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between border-b border-[rgba(46,125,90,0.08)] px-3 py-2 backdrop-blur-md lg:hidden"
        style={{ background: "linear-gradient(180deg, #f4fcf8 0%, #edf7f3 100%)" }}
      >
        <Link to="/" className="inline-flex items-center gap-2">
          <SewServeBrandImg className="h-8 max-w-[120px]" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(46,125,90,0.14)] bg-white/70 text-[#183b2d] shadow-sm"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#183b2d]/30 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside
            className="relative flex h-full w-[min(100%,220px)] flex-col"
            style={TD_SIDEBAR_SURFACE_STYLE}
          >
            <button
              type="button"
              onClick={closeMobile}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[#5a7a6d] hover:bg-[rgba(46,125,90,0.05)]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden w-[220px] shrink-0 flex-col lg:flex lg:min-h-screen"
        style={TD_SIDEBAR_SURFACE_STYLE}
      >
        {sidebarInner}
      </aside>
    </>
  );
}
