/**
 * Development: call API on port 5000 using the same host as the page (localhost vs 127.0.0.1 must match).
 * Override with REACT_APP_API_BASE_URL when needed.
 */
function apiBaseUrl() {
  const fromEnv = process.env.REACT_APP_API_BASE_URL;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    if (typeof window !== "undefined" && window.location?.hostname) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:5000`;
    }
    return "http://localhost:5000";
  }
  return "";
}

export async function api(path, options = {}) {
  const { json, ...rest } = options;
  const headers = { ...options.headers };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const base = apiBaseUrl();
  const pathname = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${pathname}`;
  let res;
  try {
    res = await fetch(url, {
      ...rest,
      credentials: "include",
      headers,
      body: json !== undefined ? JSON.stringify(json) : options.body,
    });
  } catch (networkErr) {
    const hint =
      "Check that the API server is running (port 5000) and that you opened the app with the same host you use for the API (e.g. both localhost or both 127.0.0.1).";
    throw new Error(
      networkErr instanceof Error && networkErr.message
        ? `${networkErr.message} ${hint}`
        : `Network error. ${hint}`
    );
  }
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 120);
      data = {
        error: snippet || res.statusText || "Request failed",
      };
    }
  }
  if (!res.ok) {
    let message = data.error || data.message || res.statusText || "Request failed";
    if (typeof message === "string" && (message.includes("<!DOCTYPE") || message.includes("<html"))) {
      message = `Cannot reach the API (HTTP ${res.status}). Start the backend on port 5000 and try again.`;
    }
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
