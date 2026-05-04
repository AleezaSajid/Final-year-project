import React, { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, LogOut, Menu, MessageCircle, UserRound, X } from "lucide-react";
import { SewServeBrandImg } from "./SewServeBrandImg.jsx";
import { clearUserRole } from "../utils/userRole";
import { TAILOR_SESSION_STORAGE_KEY } from "../utils/chatIdentity.js";
import { useCustomerChat } from "../context/CustomerChatContext.jsx";
import { useTailorDashboardChat } from "../context/TailorDashboardChatContext.jsx";

function isDashboardRoute(pathname) {
  if (["/select-workspace", "/workspace"].includes(pathname)) return true;
  if (["/dashboard", "/tailor/dashboard", "/customer/dashboard"].includes(pathname)) return true;
  if (pathname.startsWith("/tailor/last-review")) return true;
  if (pathname.startsWith("/customer/review")) return true;
  return false;
}

/** Customer-facing routes where navbar chat opens CustomerChatWindow (same room as tailor chat). */
function isCustomerChatRoute(pathname) {
  return pathname === "/customer/dashboard" || pathname.startsWith("/customer/review");
}

/** Tailor main dashboard — {@link TailorDashboardChatContext} is mounted here only. */
function isTailorDashboardChatRoute(pathname) {
  return pathname === "/dashboard" || pathname === "/tailor/dashboard";
}

/** Order tracking UI — {@link OrderTrackingPage} (`/orders`), scroll to #order-tracking section */
const ORDER_TRACKING_PAGE_PATH = "/orders#order-tracking";

const navLinks = [
  { label: "Dashboard", to: null, match: "dashboard" },
  { label: "Orders", to: ORDER_TRACKING_PAGE_PATH, match: "orders" },
  { label: "Profile", to: "/profile", match: "profile" },
];

export default function DashboardNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const customerChat = useCustomerChat();
  const tailorDashChat = useTailorDashboardChat();
  const tailorChatRef = useRef(tailorDashChat);
  tailorChatRef.current = tailorDashChat;
  const customerChatRef = useRef(customerChat);
  customerChatRef.current = customerChat;

  const handleCloseMobileMenu = () => setMobileOpen(false);

  const handleNavbarChatClick = () => {
    console.log("NAVBAR CHAT CLICKED", { path: location.pathname });

    if (isTailorDashboardChatRoute(location.pathname) && tailorDashChat?.openChatFromActiveOrder) {
      console.log("OPENING CONVERSATION", { role: "tailor", via: "openChatFromActiveOrder" });
      tailorDashChat.openChatFromActiveOrder();
      handleCloseMobileMenu();
      window.setTimeout(() => {
        const t = tailorChatRef.current;
        const receiverId = t?.activeChatCustomer?.id;
        const conv = t?.activeConversationId;
        console.log("CONVERSATION ID", conv);
        console.log("SENDER / RECEIVER IDS", { senderId: t?.senderId, receiverId });
      }, 0);
      return;
    }
    if (isCustomerChatRoute(location.pathname) && customerChat?.openCustomerChat) {
      const senderId = customerChat.customerId;
      const receiverId = customerChat.tailorIdForChat;
      const conv = customerChat.conversationId;
      console.log("OPENING CONVERSATION", { role: "customer", via: "openCustomerChat" });
      console.log("CONVERSATION ID", conv);
      console.log("SENDER / RECEIVER IDS", { senderId, receiverId });
      customerChat.openCustomerChat();
      handleCloseMobileMenu();
      window.setTimeout(() => {
        const c = customerChatRef.current;
        console.log("CONVERSATION ID (post-open)", c?.conversationId);
        console.log("SENDER / RECEIVER IDS (post-open)", { senderId: c?.customerId, receiverId: c?.tailorIdForChat });
      }, 0);
      return;
    }
    navigate("/select-workspace");
    handleCloseMobileMenu();
  };

  const handleLogout = () => {
    localStorage.removeItem("sewserve_auth_token");
    sessionStorage.removeItem("sewserve_auth_token");
    try {
      localStorage.removeItem(TAILOR_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearUserRole();
    navigate("/");
    handleCloseMobileMenu();
  };

  const linkIsActive = useMemo(() => {
    return (link) => {
      if (link.match === "dashboard") return isDashboardRoute(location.pathname);
      if (link.match === "orders") return location.pathname === "/orders";
      if (link.match === "profile") return location.pathname === "/profile";
      return false;
    };
  }, [location.pathname]);

  const tailorUnreadChat = tailorDashChat?.unreadChatCount ?? 0;
  const customerUnreadChat = customerChat?.unreadChatCount ?? 0;
  const isTailorChatRoute = isTailorDashboardChatRoute(location.pathname);
  const isCustomerChat = isCustomerChatRoute(location.pathname);
  const chatUnreadForRoute = isTailorChatRoute ? tailorUnreadChat : isCustomerChat ? customerUnreadChat : 0;
  const showChatUnreadBadge =
    (isTailorChatRoute || isCustomerChat) && chatUnreadForRoute > 0;
  const chatBadgeText = chatUnreadForRoute > 99 ? "99+" : String(chatUnreadForRoute);
  const chatUnreadAria =
    chatUnreadForRoute === 1
      ? "1 unread message"
      : `${chatUnreadForRoute > 99 ? "99+" : chatUnreadForRoute} unread messages`;

  return (
    <header className="ss-glass-surface sticky top-0 z-50 border-b border-white/35 font-['Inter',system-ui,sans-serif]">
      <style>
        {`
          /* Same frosted shell as home (LandingNavbar + SewServeLandingPage .ss-glass-surface) */
          .ss-glass-surface {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            backdrop-filter: blur(28px) saturate(180%);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.35),
              0 1px 2px rgba(15, 23, 42, 0.04),
              0 8px 32px -8px rgba(15, 23, 42, 0.08);
          }
          .ss-navbar-link {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.25rem 0;
          }
          .ss-navbar-link::after {
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
          .ss-navbar-link:hover::after,
          .ss-navbar-link:focus-visible::after {
            width: 100%;
          }
          .ss-navbar-link--active {
            color: rgb(15 23 42);
            font-weight: 600;
          }
          .ss-navbar-link--active::after {
            width: 100%;
            opacity: 1;
          }
        `}
      </style>

      <nav className="relative mx-auto flex w-full max-w-7xl items-center px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="relative z-20 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigate("/");
              handleCloseMobileMenu();
            }}
            className="inline-flex items-center text-lg font-bold text-slate-900"
            aria-label="Go to SewServe home"
          >
            <SewServeBrandImg
              decorative
              className="h-9 max-h-9 w-auto max-w-[min(200px,52vw)] object-contain drop-shadow-[0_2px_8px_rgba(20,44,77,0.12)]"
            />
          </button>
        </div>

        <div className="absolute left-1/2 top-1/2 z-[15] hidden -translate-x-1/2 -translate-y-1/2 md:flex md:items-center md:gap-4 lg:gap-5">
          {navLinks.map((link) => {
            const active = linkIsActive(link);
            if (link.match === "dashboard") {
              return (
                <span
                  key={link.label}
                  className={`ss-navbar-link cursor-default whitespace-nowrap px-2.5 text-sm font-medium text-slate-600 select-none ${
                    active ? "ss-navbar-link--active" : ""
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </span>
              );
            }
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`ss-navbar-link whitespace-nowrap px-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:text-slate-900 lg:px-3 ${
                  active ? "ss-navbar-link--active" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="relative z-20 ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <motion.div className="relative" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <motion.button
                type="button"
                onClick={handleNavbarChatClick}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/50 bg-white/35 shadow-sm backdrop-blur-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30 ${
                  isTailorChatRoute || isCustomerChat
                    ? "text-[#2d5a3d] hover:bg-emerald-50/50 hover:text-[#1a3d2a]"
                    : "text-slate-600 hover:bg-white/55 hover:text-[#1e293b]"
                }`}
                aria-label={
                  isTailorChatRoute
                    ? `Open chat with customer${showChatUnreadBadge ? `, ${chatUnreadAria}` : ""}`
                    : isCustomerChat
                      ? `Open chat with your tailor${showChatUnreadBadge ? `, ${chatUnreadAria}` : ""}`
                      : "Open workspace messages"
                }
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
              >
                <MessageCircle className="h-[1.125rem] w-[1.125rem] text-inherit" strokeWidth={2} aria-hidden />
              </motion.button>
              {showChatUnreadBadge ? (
                <span
                  className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold tabular-nums leading-none text-white shadow-sm ring-2 ring-white"
                  aria-hidden
                >
                  {chatBadgeText}
                </span>
              ) : null}
            </motion.div>
            <motion.button
              type="button"
              onClick={() => {
                navigate(ORDER_TRACKING_PAGE_PATH);
                handleCloseMobileMenu();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/50 bg-white/35 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white/55 hover:text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30"
              aria-label="Open order tracking"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <Bell className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
            </motion.button>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                to="/profile"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/50 bg-white/35 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white/55 hover:text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30"
                aria-label="Profile"
              >
                <UserRound className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
              </Link>
            </motion.div>
            <motion.button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a5240]/20 bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/40 focus-visible:ring-offset-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <LogOut className="h-3.5 w-3.5 opacity-90" aria-hidden />
              Logout
            </motion.button>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/45 bg-white/30 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white/45 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-controls="navbar-mobile-slideout"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <div className={`md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <div
          className={`fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleCloseMobileMenu}
          aria-hidden="true"
        />
        <aside
          id="navbar-mobile-slideout"
          className={`fixed right-0 top-0 z-50 flex h-full w-[min(100vw-2.5rem,20rem)] flex-col border-l border-white/35 bg-gradient-to-b from-white/55 to-white/25 p-5 shadow-[-12px_0_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-label="Mobile navigation menu"
        >
          <div className="flex items-center justify-between border-b border-white/25 pb-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-[#2f5a42]">Menu</p>
            <button
              type="button"
              onClick={handleCloseMobileMenu}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/30"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={handleCloseMobileMenu}
              className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                linkIsActive({ match: "dashboard" })
                  ? "bg-white/50 text-slate-900 ring-1 ring-white/45"
                  : "text-slate-600 hover:bg-white/35"
              }`}
              aria-current={linkIsActive({ match: "dashboard" }) ? "page" : undefined}
            >
              Dashboard
            </button>
            <Link
              to={ORDER_TRACKING_PAGE_PATH}
              onClick={handleCloseMobileMenu}
              className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                linkIsActive({ match: "orders" })
                  ? "bg-white/50 text-slate-900 ring-1 ring-white/45"
                  : "text-slate-600 hover:bg-white/35"
              }`}
            >
              Orders
            </Link>
            <Link
              to="/profile"
              onClick={handleCloseMobileMenu}
              className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                linkIsActive({ match: "profile" })
                  ? "bg-white/50 text-slate-900 ring-1 ring-white/45"
                  : "text-slate-600 hover:bg-white/35"
              }`}
            >
              Profile
            </Link>
          </div>
          <div className="mt-auto space-y-2 border-t border-white/25 pt-4">
            <button
              type="button"
              onClick={handleNavbarChatClick}
              className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/35 py-2.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-emerald-50/40"
              aria-label={showChatUnreadBadge ? `Messages, ${chatUnreadAria}` : "Open messages"}
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-[#2d5a3d]" strokeWidth={2} aria-hidden />
              <span className="text-[#1a3d2a]">Messages</span>
              {showChatUnreadBadge ? (
                <span
                  className="pointer-events-none absolute right-3 top-2 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold tabular-nums leading-none text-white shadow-sm ring-2 ring-white"
                  aria-hidden
                >
                  {chatBadgeText}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(ORDER_TRACKING_PAGE_PATH);
                handleCloseMobileMenu();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/35 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm"
            >
              <Bell className="h-4 w-4" aria-hidden />
              Notifications
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] py-2.5 text-sm font-semibold text-white shadow-md"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Logout
            </button>
          </div>
        </aside>
      </div>
    </header>
  );
}
