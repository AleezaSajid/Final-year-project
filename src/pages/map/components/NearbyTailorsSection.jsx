import { useEffect, useRef } from "react";
import TailorCard from "./TailorCard";

/**
 * Sortable, paginated list of tailor cards; syncs scroll with map selection.
 */
export default function NearbyTailorsSection({
  tailors,
  selectedId,
  onSelectTailor,
  onViewAccept,
  sortBy,
  onSortChange,
  visibleCount,
  onLoadMore,
  hasMore,
  primaryActionLabel,
  primaryDisabled,
  sectionTitle = "Nearby Tailors",
  showSort = true,
  hideCardPrimaryAction = false,
  sortHint,
}) {
  const cardRefs = useRef({});

  useEffect(() => {
    if (!selectedId) return;
    const el = cardRefs.current[selectedId];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  return (
    <section id="nearby-tailors" className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-['Playfair_Display',Georgia,serif] text-2xl font-semibold tracking-tight text-ink">
          {sectionTitle}
        </h2>
        {showSort ? (
          <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="rounded-xl border border-white/40 bg-white/75 px-3 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            >
              <option value="distance">Distance</option>
              <option value="rating">Rating</option>
            </select>
          </label>
        ) : sortHint ? (
          <p className="text-sm font-medium text-ink-muted">{sortHint}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {tailors.slice(0, visibleCount).map((t) => (
          <div
            key={t.id}
            ref={(el) => {
              cardRefs.current[t.id] = el;
            }}
          >
            <TailorCard
              tailor={t}
              selected={t.id === selectedId}
              onSelect={onSelectTailor}
              onViewAccept={onViewAccept}
              primaryActionLabel={primaryActionLabel}
              primaryDisabled={primaryDisabled}
              hidePrimaryAction={hideCardPrimaryAction}
            />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-xl border border-emerald-200/80 bg-white/80 px-8 py-3 text-sm font-semibold text-emerald-800 shadow-md shadow-slate-900/5 backdrop-blur-sm transition hover:border-emerald-300 hover:bg-emerald-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            Load More Tailors
          </button>
        </div>
      )}
    </section>
  );
}
