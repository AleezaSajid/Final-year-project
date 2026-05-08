import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Route guard that reuses existing AuthContext only.
 * Redirects to /login with state { from } when user is missing.
 */
export default function ProtectedRoute({ children, redirectPath = "/login" }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return children;
  if (!user) {
    return <Navigate to={redirectPath} replace state={{ from: location.pathname }} />;
  }
  return children;
}
