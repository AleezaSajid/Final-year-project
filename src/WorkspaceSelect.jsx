import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, UserRound } from "lucide-react";
import { PageBackground } from "./components/PageBackground.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { syncTailorSessionFromTailorUser } from "./utils/chatIdentity.js";
import { setUserRole } from "./utils/userRole";

const ROLE_OPTIONS = ["Tailor", "Customer"];

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  const matched = ROLE_OPTIONS.find((o) => o.toLowerCase() === role);
  return matched || "Customer";
}

function pathForSlug(slug) {
  if (slug === "tailor") return "/dashboard";
  if (slug === "customer") return "/customer/dashboard";
  return "/select-workspace";
}

function toSlug(displayRole) {
  return normalizeRole(displayRole) === "Tailor" ? "tailor" : "customer";
}

export default function WorkspaceSelect() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  const roles = useMemo(() => {
    if (!user?.role) return [];
    return [user.role === "tailor" ? "Tailor" : "Customer"];
  }, [user?.role]);

  useEffect(() => {
    document.title = "SewServe | Select workspace";
  }, []);

  useEffect(() => {
    // Auth is now backed by AuthContext (currentUser), not the legacy token key.
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (roles.length === 1) {
      const only = roles[0];
      const slug = toSlug(only);
      setUserRole(slug);
      if (slug === "tailor") {
        syncTailorSessionFromTailorUser(user);
      }
      navigate(pathForSlug(slug), { replace: true });
      return;
    }

    setReady(true);
  }, [navigate, roles, user]);

  const choose = (role) => {
    const slug = toSlug(role);
    setUserRole(slug);
    if (slug === "tailor") {
      syncTailorSessionFromTailorUser(user);
    }
    navigate(pathForSlug(slug), { replace: true });
  };

  const showTailor = roles.length === 0 || roles.includes("Tailor");
  const showCustomer = roles.length === 0 || roles.includes("Customer");

  if (!ready) {
    return (
      <div className="relative isolate flex min-h-screen items-center justify-center bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600">
        <PageBackground />
        <p className="relative z-10 text-sm text-slate-500">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-700 antialiased">
      <PageBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-apple-card border border-white/50 bg-gradient-to-b from-white/85 to-white/55 p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.2)] backdrop-blur-xl sm:p-8"
        >
          <h1 className="text-center text-apple-h1 font-bold tracking-tight text-ink">
            Select Your Workspace
          </h1>
          <p className="mt-2.5 text-center text-base leading-[1.6] text-ink-muted">Continue as</p>

          <div className="mt-8 flex flex-col gap-4 sm:gap-5">
            {showTailor ? (
              <button
                type="button"
                onClick={() => choose("Tailor")}
                className="group flex w-full items-start gap-4 rounded-apple-card border border-white/60 bg-white/50 p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:border-[#3d6b4a]/35 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/40 focus-visible:ring-offset-2"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3d6b4a] to-[#2f5a42] text-white shadow-md shadow-emerald-900/20">
                  <Scissors className="h-6 w-6" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">Tailor Dashboard</span>
                  <span className="mt-2.5 block text-base leading-[1.6] text-ink-muted">
                    Manage orders, measurements, and client conversations from your workshop.
                  </span>
                </span>
              </button>
            ) : null}

            {showCustomer ? (
              <button
                type="button"
                onClick={() => choose("Customer")}
                className="group flex w-full items-start gap-4 rounded-apple-card border border-white/60 bg-white/50 p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:border-[#3d6b4a]/35 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b6b52]/40 focus-visible:ring-offset-2"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/90 text-[#2f5a42] shadow-sm">
                  <UserRound className="h-6 w-6" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">Customer Dashboard</span>
                  <span className="mt-2.5 block text-base leading-[1.6] text-ink-muted">
                    Track orders, measurements, and updates for your tailoring requests.
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
