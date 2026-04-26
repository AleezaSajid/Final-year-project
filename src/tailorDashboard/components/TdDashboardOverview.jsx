import React, { useEffect, useMemo, useState } from "react";
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
  resolveOrderWorkflowState,
  workflowStages,
} from "../constants";
import { getPriorityScore, isTailorActiveTask } from "../../utils/workflowEngine.js";
import {
  TD_GLASS_CARD,
  TD_GLASS_CARD_COMPACT,
  TD_SECONDARY_NAVY_BTN,
} from "../tailorDashboardClassNames";

const TASK_MAP = {
  order_placed: "Review & Approve Order",
  pending: "Review & Approve Order",
  measurements_verified: "Verify Measurements",
  processing: "Processing",
  in_progress: "In Progress",
  stitching: "Stitch Garment",
  quality_check: "Quality Check",
  ready_for_delivery: "Prepare Delivery",
  last_review: "Final Inspection",
  needs_alteration: "Final Inspection",
};

/** Match Measurement Wizard ids → labels (design-brief step only). */
const WIZARD_OCCASION_LABELS = {
  wedding: "Wedding",
  casual: "Casual",
  formal: "Formal",
  party: "Party",
};
const WIZARD_URGENCY_LABELS = {
  normal: "Normal",
  urgent: "Urgent",
  express: "Express",
};
const WIZARD_INSTRUCTION_LABELS = {
  "extra-loose": "Extra loose",
  "slim-fitting": "Slim fitting",
  "soft-feel": "Soft feel",
  "heavy-look": "Heavy look",
};

function wizardSummaryFromOrder(order) {
  const fromApiNotes = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const designNote = typeof raw.designNote === "string" ? raw.designNote.trim() : "";
    const occasion = typeof raw.occasion === "string" ? raw.occasion.trim() : "";
    const urgency = typeof raw.urgency === "string" ? raw.urgency.trim() : "";
    const specialInstructions =
      typeof raw.specialInstructions === "string" ? raw.specialInstructions.trim() : "";
    if (!designNote && !occasion && !urgency && !specialInstructions) return null;
    return { designNote, occasion, urgency, specialInstructions };
  };

  const fromBrief = (db) => {
    if (!db || typeof db !== "object") return null;
    const designNote = typeof db.designNotes === "string" ? db.designNotes.trim() : "";
    const occasion = Array.isArray(db.occasion)
      ? db.occasion
          .map((id) => (typeof id === "string" ? WIZARD_OCCASION_LABELS[id] || id : ""))
          .filter(Boolean)
          .join(", ")
      : "";
    const urgencyRaw = typeof db.urgency === "string" ? db.urgency : "";
    const urgency = urgencyRaw ? WIZARD_URGENCY_LABELS[urgencyRaw] || urgencyRaw : "";
    const specialInstructions = Array.isArray(db.instructions)
      ? db.instructions
          .map((id) => (typeof id === "string" ? WIZARD_INSTRUCTION_LABELS[id] || id : ""))
          .filter(Boolean)
          .join(", ")
      : "";
    if (!designNote && !occasion && !urgency && !specialInstructions) return null;
    return { designNote, occasion, urgency, specialInstructions };
  };

  return (
    fromApiNotes(order.notes) ||
    fromApiNotes(order.orderPayload?.notes) ||
    fromBrief(order.wizardData?.designBrief) ||
    fromBrief(order.orderPayload?.designBrief)
  );
}

function orderIsActiveCurrentTask(order) {
  const w = resolveOrderWorkflowState(order);
  return isTailorActiveTask(order) && w.internalStatus !== "completed";
}

export default function TdDashboardOverview({
  notifications,
  notificationText,
  welcomeName,
  displayStats,
  upcomingOrders,
  orders,
  calendarPreview,
  measurementsCandidates,
  setActiveOrderId,
  donutGradient,
  advanceWorkflow,
  navigate,
  activeOrder,
  activeOrderId,
  updateOrderStatus,
  openMeasurementsReview,
  fetchOrders,
}) {
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  useEffect(() => {
    const onOrdersInvalidate = () => {
      void fetchOrders?.();
    };
    window.addEventListener("sewserve:orders-refresh", onOrdersInvalidate);
    return () => window.removeEventListener("sewserve:orders-refresh", onOrdersInvalidate);
  }, [fetchOrders]);

  const tasks = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];

    const filtered = [...list]
      .filter((order) => orderIsActiveCurrentTask(order))
      .sort((a, b) => getPriorityScore(a) - getPriorityScore(b));

    return filtered.map((order) => {
      const { internalStatus: internal } = resolveOrderWorkflowState(order);
      const idStr = String(order._id ?? order.id ?? "");
      const _idStr = order._id != null ? String(order._id) : idStr;
      const item =
        (typeof order.garmentType === "string" && order.garmentType.trim()) ||
        (order.orderPayload?.garment && typeof order.orderPayload.garment.type === "string"
          ? order.orderPayload.garment.type
          : "") ||
        "";
      return {
        _id: _idStr,
        id: idStr,
        title: TASK_MAP[internal] || "Continue Work",
        customerName: order.customerName || order.customerId || "",
        customerId: order.customerId,
        item,
        customer: order.customerName || order.customerId || "",
        garment: item || order.garmentType || "",
        due: order.dueDate || order.date,
        status: internal,
        statusInternal: internal,
        wizardSummary: wizardSummaryFromOrder(order),
        /** Full normalized row for `WizardOrderReviewModal` (wizard payload, measurements, etc.). */
        sourceOrder: order,
      };
    });
  }, [orders]);

  const openCurrentTaskWizard = (task) => {
    if (!task?.sourceOrder) return;
    const key = String(task._id || task.id || "");
    if (key) setActiveOrderId(key);
    openMeasurementsReview(task.sourceOrder);
  };

  const handleMarkDone = async (taskId) => {
    try {
      const order = orders.find((o) => String(o._id ?? o.id) === String(taskId));
      if (!order) return;
      const { workflowIndex: currentIndex } = resolveOrderWorkflowState(order);
      const nextIndex = Math.min(currentIndex + 1, workflowStages.length - 1);
      const nextStatus = workflowStages[nextIndex].status;
      await updateOrderStatus(taskId, nextStatus);
      if (nextStatus === "last_review") {
        navigate(`/tailor/last-review/${taskId}`, {
          state: {
            order: {
              ...order,
              status: "last_review",
            },
          },
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

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
            {tasks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No active tasks</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {tasks.map((task) => {
                  const rowKey = task._id || task.id;
                  const activeIdx = getStatusIndex(task.statusInternal);
                  const isRowActive = String(rowKey) === String(activeOrderId);
                  const isExpanded = expandedTaskId === rowKey;
                  return (
                    <li
                      key={rowKey}
                      className={`overflow-hidden rounded-xl border transition-colors ${
                        isRowActive ? "border-emerald-500 bg-emerald-50" : "border-slate-200/50 bg-white/20"
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openCurrentTaskWizard(task);
                          }
                        }}
                        onClick={() => openCurrentTaskWizard(task)}
                        className="flex w-full flex-col gap-2 p-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {task.customer}
                            {task.garment ? <span className="text-slate-400"> · {task.garment}</span> : null}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">Due: {task.due || "—"}</p>
                          {task.wizardSummary ? (
                            <div className="mt-2 space-y-2 border-t border-slate-200/40 pt-2">
                              {task.wizardSummary.designNote ? (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Notes
                                  </p>
                                  <p className="mt-0.5 text-xs leading-snug text-slate-700">
                                    {task.wizardSummary.designNote}
                                  </p>
                                </div>
                              ) : null}
                              {task.wizardSummary.occasion ? (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Occasion
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-700">{task.wizardSummary.occasion}</p>
                                </div>
                              ) : null}
                              {task.wizardSummary.urgency ? (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Urgency
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-700">{task.wizardSummary.urgency}</p>
                                </div>
                              ) : null}
                              {task.wizardSummary.specialInstructions ? (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Special instructions
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-700">
                                    {task.wizardSummary.specialInstructions}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCurrentTaskWizard(task);
                            setExpandedTaskId((id) => (id === rowKey ? null : rowKey));
                          }}
                          className="shrink-0 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-white"
                        >
                          View
                        </button>
                      </div>
                      {isExpanded ? (
                        <div className="space-y-3 border-t border-slate-200/40 bg-white/40 px-3 py-3 sm:px-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Workflow</p>
                          <ol className="space-y-2">
                            {workflowStages.map((stage, i) => {
                              const isDone = i < activeIdx;
                              const isCurrent = i === activeIdx;
                              return (
                                <li key={stage.status} className="flex items-center gap-2 text-sm text-slate-700">
                                  <span className="w-5 text-center" aria-hidden>
                                    {isDone ? "✔" : isCurrent ? "➤" : "○"}
                                  </span>
                                  <span className={isCurrent ? "font-semibold text-emerald-800" : ""}>{stage.label}</span>
                                </li>
                              );
                            })}
                          </ol>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleMarkDone(String(rowKey));
                              }}
                              className="rounded-lg bg-gradient-to-r from-[#166534] to-[#15803d] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105"
                            >
                              Mark done
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>

          <motion.div
            id="td-upcoming"
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
                if (!activeOrder) {
                  navigate("/tailor-profile");
                  return;
                }
                const w = resolveOrderWorkflowState(activeOrder);
                if (w.workflowIndex < workflowStages.length - 1 && w.internalStatus !== "needs_alteration") {
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
                      onClick={() => {
                        setActiveOrderId(order.id);
                        openMeasurementsReview?.(order);
                      }}
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
        </div>
      </div>
    </>
  );
}
