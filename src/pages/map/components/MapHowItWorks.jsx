import { CheckCircle2, MapPin, Package, Search, Send, UserCheck } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Place Your Order",
    description: "Enter requirements, location, and delivery time.",
    color: "bg-emerald-100 text-emerald-800",
  },
  {
    icon: Send,
    title: "Nearby Tailors Get Notified",
    description: "Tailors near you will see your order request.",
    color: "bg-sky-100 text-sky-800",
  },
  {
    icon: UserCheck,
    title: "Tailor Accepts the Order",
    description: "The nearest tailor accepts your order.",
    color: "bg-teal-100 text-teal-800",
  },
  {
    icon: Package,
    title: "Work in Progress",
    description: "Your order is in progress and you can track it anytime.",
    color: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70",
  },
  {
    icon: MapPin,
    title: "Order Completed",
    description: "Your stitching is ready for delivery or pickup.",
    color: "bg-lime-100 text-lime-900",
  },
];

export default function MapHowItWorks() {
  return (
    <aside className="ss-glass-card rounded-apple-card p-5 shadow-sm shadow-slate-900/5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden />
        How It Works
      </h2>
      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${step.color}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/90">Step {i + 1}</p>
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 text-sm leading-snug text-ink-muted">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
