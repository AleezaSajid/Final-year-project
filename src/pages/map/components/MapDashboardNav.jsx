import { Link, NavLink } from "react-router-dom";
import { Plus, Scissors } from "lucide-react";

const linkClass = ({ isActive }) =>
  `rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-emerald-100/90 text-emerald-900"
      : "text-slate-600 hover:bg-white/50 hover:text-slate-900"
  }`;

/**
 * Top navigation for the tailor booking dashboard (map page).
 * Glass + emerald accents to match SewServe landing.
 */
export default function MapDashboardNav() {
  return (
    <header className="ss-glass-surface sticky top-0 z-50 border-b border-white/35 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4a7c59] to-[#355542] text-white shadow-md shadow-emerald-900/20">
            <Scissors className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold tracking-tight text-ink">StitchNear</span>
            <span className="block truncate text-xs font-medium text-ink-muted">Tailored for You</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <a
            href="#map-how"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/50 hover:text-slate-900"
          >
            How It Works
          </a>
          <NavLink to="/orders" className={linkClass}>
            Orders
          </NavLink>
          <span
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
            title="Coming soon"
          >
            Messages
          </span>
          <NavLink to="/profile" className={linkClass}>
            Profile
          </NavLink>
        </nav>

        <Link
          to="/measurements/new"
          className="hero-cta inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 bg-gradient-to-b from-[#4a7c59] to-[#355542]"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Place New Order</span>
            <span className="sm:hidden">New Order</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
