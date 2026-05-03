import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Search } from "lucide-react";

/**
 * Floating glass search bar (ride-hailing style).
 */
export default function MapSearchBar({ value, onChange, placeholder = "Search tailors by name…" }) {
  return (
    <div className="pointer-events-auto flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
      <Link
        to="/"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80 backdrop-blur-md transition active:scale-[0.98]"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <label className="relative flex min-w-0 flex-1">
        <span className="sr-only">Search</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-2xl border-0 bg-white/95 py-3 pl-12 pr-4 text-[15px] font-medium text-slate-900 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80 backdrop-blur-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          autoComplete="off"
        />
      </label>
      <div
        className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/95 text-teal-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80 backdrop-blur-md sm:flex"
        aria-hidden
      >
        <MapPin className="h-5 w-5" />
      </div>
    </div>
  );
}
