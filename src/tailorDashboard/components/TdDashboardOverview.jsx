import React from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Shirt,
} from "lucide-react";
import {
  DEFAULT_AVATAR,
  getStatusIndex,
  normalizeStatus,
  workflowStages,
} from "../constants";
import {
  TD_GLASS_CARD,
  TD_GLASS_CARD_COMPACT,
  TD_SECONDARY_NAVY_BTN,
} from "../tailorDashboardClassNames";

export default function TdDashboardOverview({
  notifications,
  notificationText,
  welcomeName,
  displayStats,
  upcomingOrders,
  currentTaskLines,
  workflowProgressPct,
  expectedDeliveryLabel,
  calendarPreview,
  measurementsCandidates,
  setActiveOrderId,
  donutGradient,
  advanceWorkflow,
  navigate,
  activeOrder,
}) {
  const glassCard = TD_GLASS_CARD;
  const glassCardCompact = TD_GLASS_CARD_COMPACT;
  const secondaryNavyBtn = TD_SECONDARY_NAVY_BTN;

  return (
    <>
      {notifications.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {notifications.map((note, index) => (
            <motion.div
              key={`${index}-${notificationText(note)}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              className="rounded-xl border border-amber-200/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 shadow-sm backdrop-blur-sm"
            >
              {notificationText(note)}
            </motion.div>
          ))}
        </div>
      ) : null}

      <header className="text-center">
        <motion.h1
          className="text-apple-h1 font-bold tracking-tight text-ink"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Welcome Back, {welcomeName}!
        </motion.h1>
        <p className="mt-2.5 text-base leading-[1.6] text-ink-muted">Your Tailor Management Dashboard</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active Orders",
            value: displayStats.inProgress,
            icon: Shirt,
          },
          {
            label: "Upcoming Fittings",
            value: upcomingOrders.length,
            icon: CalendarDays,
          },
          {
            label: "Pending Approvals",
            value: displayStats.pending,
            icon: CheckCircle2,
          },
          {
            label: "Client Messages",
            value: notifications.length,
            icon: MessageCircle,
          },
        ].map((item, i) => {
          const StatIcon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06 * i, ease: [0.25, 0.1, 0.25, 1] }}
              className={`${glassCardCompact} flex flex-col items-center justify-center gap-2 text-center`}
            >
              <StatIcon className="h-6 w-6 text-slate-500" strokeWidth={1.75} aria-hidden />
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="text-3xl font-bold tabular-nums text-ink">{item.value}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-6 lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <div className="flex items-start gap-3 border-b border-slate-200/50 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/80 text-amber-700 shadow-sm">
                <ClipboardList className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-apple-h3 font-semibold text-ink">Current Tasks</h2>
                <p className="mt-2.5 text-xs leading-[1.6] text-ink-muted">Priority work on your bench</p>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {currentTaskLines.map((line, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 border-b border-slate-200/40 pb-3 text-sm text-slate-700 last:border-0 last:pb-0"
                >
                  <span className="text-base leading-none text-emerald-600" aria-hidden>
                    ✶
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700"
                  initial={false}
                  animate={{ width: `${workflowProgressPct}%` }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2 text-right text-xs text-slate-500">
                Expected delivery: <span className="font-medium text-slate-700">{expectedDeliveryLabel}</span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <div className="flex items-start gap-3 border-b border-slate-200/50 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100/80 text-sky-700 shadow-sm">
                <Calendar className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex-1">
                <h2 className="text-apple-h3 font-semibold text-ink">Calendar Schedule</h2>
                <p className="text-xs text-slate-500">Next deadlines</p>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {calendarPreview.length > 0 ? (
                calendarPreview.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-200/40 pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <span className="font-medium text-slate-800">{o.customerName}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {o.dueDate || o.date}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No scheduled items yet.</li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => document.getElementById("td-upcoming")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-5 w-full rounded-full border border-white/60 bg-white/70 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-[0.99]"
            >
              View Calendar
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <h2 className="text-apple-h3 font-semibold text-ink">Recent Messages</h2>
            <div className="mt-4 space-y-4">
              {notifications.slice(0, 4).length > 0 ? (
                notifications.slice(0, 4).map((note, index) => {
                  const text = notificationText(note);
                  return (
                    <div
                      key={`${index}-${text}`}
                      className="flex gap-3 border-b border-slate-200/40 pb-4 last:border-0 last:pb-0"
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-slate-700">
                          &ldquo;{text.length > 96 ? `${text.slice(0, 96)}…` : text}&rdquo;
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{index === 0 ? "Today" : "Recently"}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No messages yet.</p>
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <h2 className="text-apple-h3 font-semibold text-ink">Measurements to Review</h2>
            <ul className="mt-4 space-y-3">
              {measurementsCandidates.length > 0 ? (
                measurementsCandidates.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center gap-3 border-b border-slate-200/40 pb-3 last:border-0 last:pb-0"
                  >
                    <img
                      src={DEFAULT_AVATAR}
                      alt=""
                      className="h-11 w-11 rounded-full border border-white/60 object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{order.customerName}</p>
                      <p className="text-xs text-slate-500">New measurements</p>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setActiveOrderId(order.id)}
                      className={secondaryNavyBtn}
                    >
                      Review
                    </motion.button>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">Nothing pending review.</li>
              )}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <h2 className="text-apple-h3 font-semibold text-ink">Order Overview</h2>
            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
              <ul className="w-full space-y-2.5 text-sm sm:max-w-[12rem]">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">
                    In Progress — <span className="font-semibold text-slate-900">{displayStats.inProgress}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-slate-600">
                    Awaiting Approval — <span className="font-semibold text-slate-900">{displayStats.pending}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-600">
                    Completed — <span className="font-semibold text-slate-900">{displayStats.completed}</span>
                  </span>
                </li>
              </ul>
              <div className="relative h-36 w-36 shrink-0">
                <div
                  className="absolute inset-0 rounded-full shadow-[inset_0_2px_12px_rgba(15,23,42,0.06)]"
                  style={{ background: donutGradient }}
                />
                <div className="absolute inset-[20%] rounded-full bg-white/95 shadow-inner backdrop-blur-sm" />
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                if (
                  activeOrder &&
                  getStatusIndex(activeOrder.status) < workflowStages.length - 1 &&
                  normalizeStatus(activeOrder.status) !== "needs_alteration"
                ) {
                  advanceWorkflow();
                } else {
                  navigate("/tailor-profile");
                }
              }}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#166534] to-[#15803d] py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:brightness-105"
            >
              Save &amp; Continue
              <ChevronRight className="h-4 w-4" aria-hidden />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
