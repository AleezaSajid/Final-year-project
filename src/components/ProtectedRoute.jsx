import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Route guard that reuses existing AuthContext only.
 * Redirects to /login with state { from } when user is missing.
 */
export default function ProtectedRoute({
  children,
  redirectPath = "/login",
  allowedRoles = null,
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
  return children;
}
