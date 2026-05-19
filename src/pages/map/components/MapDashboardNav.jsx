import { Link, NavLink } from "react-router-dom";
import { SewServeBrandImg } from "../../../components/SewServeBrandImg.jsx";

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
    <header className="ss-glass-surface sticky top-0 z-50 border-b border-white/35 shadow-[0_6px_26px_-10px_rgba(15,23,42,0.07)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
          aria-label="SewServe — home"
        >
          <SewServeBrandImg
            decorative
            className="h-9 max-h-[44px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition-[filter,transform] duration-[250ms] ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/orders" className={linkClass}>
            Orders
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
