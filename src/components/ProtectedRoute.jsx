import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isTailorProfileIncomplete } from "../utils/tailorOnboarding.js";

/**
 * Route guard that reuses existing AuthContext only.
 * Redirects to /login with state { from } when user is missing.
 */
export default function ProtectedRoute({
  children,
  redirectPath = "/login",
  allowedRoles = null,
  /** "require-complete" → incomplete tailors sent to onboarding; "require-incomplete" → complete tailors sent to dashboard */
  tailorOnboardingGate = null,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to={redirectPath} replace state={{ from: location.pathname }} />;
  }
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = user?.role ? String(user.role).trim() : "";
    if (!allowedRoles.includes(role)) {
      return <Navigate to={redirectPath} replace state={{ from: location.pathname }} />;
    }
  }
  if (tailorOnboardingGate === "require-complete" && isTailorProfileIncomplete(user)) {
    return <Navigate to="/tailor/complete-profile" replace state={{ from: location.pathname }} />;
  }
  if (tailorOnboardingGate === "require-incomplete" && !isTailorProfileIncomplete(user)) {
    return <Navigate to="/tailor/dashboard" replace />;
  }
  return children;
}
