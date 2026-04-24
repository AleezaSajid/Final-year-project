export const ROLE_KEY = "sewserve_user_role";

/** Keeps RoleContext in sync when role is set outside React. */
export const ROLE_CHANGE_EVENT = "sewserve-role-change";

export function setUserRole(role) {
  if (role !== "tailor" && role !== "customer" && role !== "admin") return;
  localStorage.setItem(ROLE_KEY, role);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: role }));
  }
}

export function getUserRole() {
  let role = localStorage.getItem(ROLE_KEY);
  if (role === "tailor" || role === "customer" || role === "admin") {
    return role;
  }
  const legacy = localStorage.getItem("sewserve_selected_role");
  if (legacy === "tailor" || legacy === "customer" || legacy === "admin") {
    localStorage.setItem(ROLE_KEY, legacy);
    localStorage.removeItem("sewserve_selected_role");
    return legacy;
  }
  return null;
}

export function clearUserRole() {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem("sewserve_selected_role");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: null }));
  }
}
