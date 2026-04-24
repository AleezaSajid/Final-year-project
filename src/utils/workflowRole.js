import { getUserRole } from "./userRole.js";

const VALID = new Set(["customer", "tailor", "admin"]);

/**
 * Resolves the role that controls workflow PUT permissions for the tailor dashboard.
 * Prefers `user.role` from auth when set; otherwise uses existing localStorage role
 * (see getUserRole). Missing/unknown → "customer" (read-only for workflow changes).
 */
export function resolveWorkflowControlRole(user) {
  if (user && user.role != null && String(user.role).trim() !== "") {
    const r = String(user.role).trim().toLowerCase();
    if (VALID.has(r)) return r;
  }
  const s = getUserRole();
  if (s && VALID.has(s)) return s;
  return "customer";
}

export function canUpdateWorkflowStatus(role) {
  return role === "tailor" || role === "admin";
}
