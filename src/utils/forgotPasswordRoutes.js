/** Shared forgot-password entry paths (single page for customer + tailor). */
export const FORGOT_PASSWORD_PATH = "/forgot-password";

export function forgotPasswordHref(from) {
  const role = from === "tailor" ? "tailor" : "customer";
  return `${FORGOT_PASSWORD_PATH}?from=${role}`;
}

export function forgotPasswordLinkState(loginPath) {
  return { loginPath };
}

/**
 * Where to send the user after a successful password reset.
 * `?from=customer` → /login, `?from=tailor` → /tailor-login
 */
export function resolveLoginPathAfterReset(searchParams, locationState) {
  const fromState = locationState?.loginPath;
  if (typeof fromState === "string" && fromState.trim()) {
    return fromState.trim();
  }
  const fromQuery = searchParams?.get?.("from") ?? searchParams?.from;
  if (fromQuery === "tailor") return "/tailor-login";
  if (fromQuery === "customer") return "/login";
  return "/login";
}
