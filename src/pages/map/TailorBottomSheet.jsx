import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, MapPin, Sparkles } from "lucide-react";

function useSnapHeights() {
  const [heights, setHeights] = useState({
    collapsed: 64,
    half: 320,
    full: 640,
  });

  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight;
      const collapsed = 56;
      const half = Math.min(Math.max(Math.round(vh * 0.4), 300), Math.round(vh * 0.52));
      const full = Math.round(vh * 0.92);
      setHeights({ collapsed, half, full });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return heights;
}

function snapHeightToState(h, heights) {
  const { collapsed: c, half, full } = heights;
  const m1 = (c + half) / 2;
  const m2 = (half + full) / 2;
  if (h < m1) return "collapsed";
  if (h < m2) return "half";
  return "full";
}

function nextSnapCycle(current) {
  if (current === "collapsed") return "half";
  if (current === "half") return "full";
  return "collapsed";
}

/**
 * Draggable bottom sheet: collapsed · half (~2–3 tailors) · full scrollable list.
 * Only the list region scrolls; CTA stays pinned above safe area.
 */
export default function TailorBottomSheet({
  tailors,
  selectedId,
  onSelectTailor,
  onRequest,
  sheetSnap,
  onSheetSnapChange,
}) {
  const heights = useSnapHeights();
  const rowRefs = useRef({});
  const [dragHeight, setDragHeight] = useState(null);
  const dragRef = useRef(null);
  const tapRef = useRef({ y: 0, moved: false });
  const latestHRef = useRef(heights.collapsed);

  const targetHeight = heights[sheetSnap];
  const displayHeight = dragHeight ?? targetHeight;

  const isContentVisible = displayHeight > heights.collapsed + 20;

  useEffect(() => {
    latestHRef.current = displayHeight;
  }, [displayHeight]);

  useEffect(() => {
    if (!selectedId || !isContentVisible) return;
    const el = rowRefs.current[selectedId];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId, isContentVisible]);

  const selected = tailors.find((t) => t.id === selectedId) ?? null;

  const finalizeDrag = useCallback(() => {
    if (!dragRef.current) return;
    const next = snapHeightToState(latestHRef.current, heights);
    onSheetSnapChange(next);
    setDragHeight(null);
    dragRef.current = null;
  }, [heights, onSheetSnapChange]);

  const onPointerDown = (e) => {
    tapRef.current = { y: e.clientY, moved: false };
    dragRef.current = { startY: e.clientY, startH: displayHeight };
    setDragHeight(displayHeight);
    latestHRef.current = displayHeight;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    if (Math.abs(e.clientY - tapRef.current.y) > 8) tapRef.current.moved = true;
    const dy = e.clientY - dragRef.current.startY;
    const rawH = dragRef.current.startH - dy;
    const min = heights.collapsed;
    const max = heights.full;
    const h = Math.min(max, Math.max(min, Math.round(rawH)));
    latestHRef.current = h;
    setDragHeight(h);
  };

  const onPointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!dragRef.current) return;
    if (!tapRef.current.moved) {
      onSheetSnapChange(nextSnapCycle(sheetSnap));
      setDragHeight(null);
      dragRef.current = null;
      return;
    }
    finalizeDrag();
  };

  const onPointerCancel = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragHeight(null);
    dragRef.current = null;
  };

  return (
    <motion.div
      className="pointer-events-auto flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-16px_48px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/90"
      initial={false}
      animate={{ height: displayHeight }}
      transition={
        dragHeight != null
          ? { duration: 0 }
          : { type: "spring", stiffness: 440, damping: 40, mass: 0.85 }
      }
    >
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={sheetSnap === "collapsed" ? 0 : sheetSnap === "half" ? 1 : 2}
        aria-label="Resize tailor list. Drag vertically or tap to change step."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (sheetSnap === "collapsed") onSheetSnapChange("half");
            else if (sheetSnap === "half") onSheetSnapChange("full");
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (sheetSnap === "full") onSheetSnapChange("half");
            else if (sheetSnap === "half") onSheetSnapChange("collapsed");
          }
        }}
        className="flex w-full shrink-0 cursor-grab touch-none flex-col items-center gap-2 rounded-t-[28px] pt-3 pb-2 text-slate-500 outline-none transition hover:bg-slate-50/80 active:cursor-grabbing active:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-teal-500/40"
      >
        <span className="h-1 w-10 rounded-full bg-slate-300" />
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
          Nearby tailors
          <motion.span
            animate={{ rotate: sheetSnap === "full" ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="h-4 w-4" />
          </motion.span>
        </span>
      </div>

      {isContentVisible && (
        <>
          <div
            className="min-h-0 flex-1 overflow-hidden px-4 pt-1"
            style={{ touchAction: "pan-y" }}
          >
            <div
              className="max-h-full overflow-y-auto overscroll-y-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <ul className="flex flex-col gap-2 pb-2">
                <AnimatePresence initial={false}>
                  {tailors.map((t) => {
                    const active = t.id === selectedId;
                    return (
                      <motion.li
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          type="button"
                          ref={(el) => {
                            rowRefs.current[t.id] = el;
                          }}
                          onClick={() => onSelectTailor(t)}
                          className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition ${
                            active
                              ? "border-teal-400 bg-teal-50/90 shadow-md shadow-teal-900/10 ring-2 ring-teal-400/50"
                              : "border-slate-200/90 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50/90"
                          }`}
                        >
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              active ? "bg-teal-600 text-white" : "bg-slate-100 text-teal-700"
                            }`}
                          >
                            <Sparkles className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">{t.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                              {t.distanceLabel}
                              <span className="text-slate-300">·</span>
                              <span className="truncate">{t.specialty}</span>
                            </p>
                          </div>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              {tailors.length === 0 && (
                <p className="py-8 text-center text-sm font-medium text-slate-500">
                  No tailors match your search.
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200/90 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
            <motion.button
              type="button"
              disabled={!selected}
              onClick={() => selected && onRequest(selected)}
              whileHover={selected ? { scale: 1.01 } : {}}
              whileTap={selected ? { scale: 0.98 } : {}}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-teal-500 to-teal-700 py-4 text-[15px] font-bold tracking-tight text-white shadow-[0_8px_28px_rgba(13,148,136,0.45)] ring-1 ring-white/20 transition hover:from-teal-400 hover:to-teal-600 hover:shadow-[0_12px_36px_rgba(13,148,136,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Request Tailor
              {selected && (
                <span className="max-w-[45%] truncate font-semibold opacity-90">· {selected.name}</span>
              )}
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}
