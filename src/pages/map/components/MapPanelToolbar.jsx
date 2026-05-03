import { Search } from "lucide-react";

/**
 * Map card toolbar: search + radius (radius filters list/map data in parent).
 */
export default function MapPanelToolbar({
  search,
  onSearchChange,
  radiusKm,
  onRadiusChange,
  /** When set, radius is fixed (wizard select mode) — no dropdown. */
  radiusLockedKm,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/35 bg-white/[0.08] px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <label className="relative flex min-w-0 max-w-md flex-1">
        <span className="sr-only">Search tailors</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tailors…"
          className="w-full rounded-xl border border-white/40 bg-white/70 py-2.5 pl-10 pr-3 text-sm font-medium text-ink shadow-sm placeholder:text-ink-subtle backdrop-blur-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
        />
      </label>
      <div className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-ink-muted">
        <span>Search radius:</span>
        {radiusLockedKm != null ? (
          <span className="rounded-xl border border-white/40 bg-white/75 px-3 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur-sm">
            {radiusLockedKm} km
          </span>
        ) : (
          <select
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="rounded-xl border border-white/40 bg-white/75 px-3 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          >
            <option value={3}>3 km</option>
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
          </select>
        )}
      </div>
    </div>
  );
}
