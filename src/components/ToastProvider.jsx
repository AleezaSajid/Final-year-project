import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createPortal } from "react-dom";

const ToastContext = createContext(null);

function iconFor(type) {
  if (type === "success") return CheckCircle2;
  if (type === "error") return TriangleAlert;
  return Info;
}

function toneClasses(type) {
  if (type === "success") return "border-emerald-200/70 bg-emerald-50/80 text-emerald-950";
  if (type === "error") return "border-rose-200/70 bg-rose-50/80 text-rose-950";
  return "border-slate-200/70 bg-white/80 text-slate-900";
}

export function ToastProvider({ children }) {
  const reduced = useReducedMotion();
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) window.clearTimeout(tm);
    timersRef.current.delete(id);
  }, []);

  const push = useCallback(
    (toast) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const next = {
        id,
        type: toast?.type || "info",
        title: String(toast?.title || "").trim(),
        message: String(toast?.message || "").trim(),
        durationMs: Number.isFinite(Number(toast?.durationMs)) ? Number(toast.durationMs) : 2400,
      };
      setToasts((prev) => [next, ...prev].slice(0, 4));
      timersRef.current.set(
        id,
        window.setTimeout(() => dismiss(id), next.durationMs)
      );
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      success: (title, message, opts = {}) => push({ type: "success", title, message, ...opts }),
      error: (title, message, opts = {}) => push({ type: "error", title, message, ...opts }),
      info: (title, message, opts = {}) => push({ type: "info", title, message, ...opts }),
      dismiss,
    }),
    [dismiss, push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            <div className="pointer-events-none fixed right-3 top-3 z-[10060] flex w-[min(92vw,22rem)] flex-col gap-2 sm:right-5 sm:top-5">
              <AnimatePresence initial={false}>
                {toasts.map((t) => {
                  const Icon = iconFor(t.type);
                  return (
                    <motion.div
                      key={t.id}
                      initial={reduced ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
                      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                      className={`pointer-events-auto rounded-2xl border px-3.5 py-3 shadow-[0_18px_45px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl ${toneClasses(
                        t.type
                      )}`}
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/55 ring-1 ring-white/60">
                          <Icon className="h-4.5 w-4.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          {t.title ? (
                            <p className="truncate text-sm font-semibold">{t.title}</p>
                          ) : null}
                          {t.message ? (
                            <p className="mt-0.5 text-sm leading-snug text-slate-700">{t.message}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => dismiss(t.id)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                          aria-label="Dismiss notification"
                        >
                          <X className="h-4.5 w-4.5" aria-hidden />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

