import { io } from "socket.io-client";
import { getApiBaseUrl } from "./api/client.js";

function resolveSocketUrl() {
  if (typeof process !== "undefined" && process.env.REACT_APP_SOCKET_URL) {
    return String(process.env.REACT_APP_SOCKET_URL).replace(/\/$/, "");
  }
  const base = typeof window !== "undefined" ? getApiBaseUrl() : "";
  if (base) return base;
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:5000";
  }
  return "";
}

const url = resolveSocketUrl();

/**
 * Polling first improves reliability in dev (some setups block or delay WebSocket handshakes).
 * Same URL as the REST API (localhost vs 127.0.0.1) so the handshake and CORS line up.
 */
export const socket = io(url, {
  // Must connect to port 5000; manual connect() was easy to miss and blocked all sends.
  autoConnect: true,
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionDelay: 400,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 20,
  timeout: 20000,
  withCredentials: true,
});

if (typeof window !== "undefined") {
  window.socket = socket;
  if (process.env.NODE_ENV === "development") {
    socket.on("connect", () => {
      // eslint-disable-next-line no-console
      console.info("[chat] socket connected", socket.id, url);
    });
    socket.on("connect_error", (e) => {
      // eslint-disable-next-line no-console
      console.error("[socket] connect_error", e?.message || e);
    });
    socket.on("disconnect", (reason) => {
      // eslint-disable-next-line no-console
      console.warn("[socket] disconnect", reason);
    });
  }
}

/**
 * Runs `fn` when the socket is connected, calling `connect()` if needed.
 * Use for join_*, send_message, and request_history.
 */
export function ensureSocketThen(fn) {
  if (typeof window === "undefined" || typeof fn !== "function") return;
  if (socket.connected) {
    if (typeof queueMicrotask === "function") queueMicrotask(fn);
    else setTimeout(fn, 0);
    return;
  }
  const run = () => {
    try {
      fn();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[socket] ensureSocketThen", e);
    }
  };
  socket.once("connect", run);
  socket.connect();
}

/** Reconnect after login/register so the handshake sends the new session cookie. */
export function reconnectSocketSession() {
  if (typeof window === "undefined") return;

  try {
    if (socket.connected) {
      socket.disconnect();
    }

    socket.connect();
  } catch (error) {
    console.error("[socket] reconnectSocketSession failed", error);
  }
}
