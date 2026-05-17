import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Inbox,
  MessageCircle,
  Ruler,
  Shirt,
  Sparkles,
} from "lucide-react";
import {
  DEFAULT_AVATAR,
  formatStatusLabel,
  getStatusIndex,
  resolveOrderWorkflowState,
  workflowStages,
} from "../constants";
import { getPriorityScore, isTailorCurrentTaskOrder } from "../../utils/workflowEngine.js";
import {
  TD_CHATS_SURFACE,
  TD_GLASS_CARD,
  TD_GLASS_CARD_COMPACT,
  TD_GHOST_BTN,
  TD_HERO_CARD,
  TD_PRIMARY_BUTTON_CLASS,
  TD_SECONDARY_NAVY_BTN,
  TD_STAT_ICON,
} from "../tailorDashboardClassNames";
import { isOrderAwaitingTailorAccept } from "../../chatUtils.js";
import RecentChatsPreviewCard from "../../components/chat/RecentChatsPreviewCard.jsx";

const TASK_MAP = {
  accepted: "Accepted Order",
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

const STAT_ACCENTS = [
  "bg-[#E8F3EE] text-[#1F6B52]",
  "bg-[#F3EBDD] text-[#8B6914]",
  "bg-[#EEF2FF] text-[#4338CA]",
  "bg-[#FCE7F3] text-[#BE185D]",
];

function orderIsActiveCurrentTask(order) {
  return isTailorCurrentTaskOrder(order);
}

function taskWorkflowMeta(order) {
  const { internalStatus, workflowIndex } = resolveOrderWorkflowState(order);
  const step = workflowStages[workflowIndex] || workflowStages[0];
  const isFreshAccept =
    Boolean(order?.acceptedAt) &&
    (internalStatus === "pending" || internalStatus === "accepted");
  return {
    internalStatus,
    workflowIndex,
    stepLabel: step?.label || formatStatusLabel(internalStatus),
    chipLabel: isFreshAccept ? "Accepted" : internalStatus === "completed" ? "Completed" : "In Progress",
    isFreshAccept,
  };
}

function EmptyState({ icon: Icon, message, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#E5E7EB]/90 bg-gradient-to-b from-[#FAFBFA] to-[#F4F7F5] px-3 text-center ${compact ? "py-4" : "py-5"}`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-[#F3EBDD]/90 text-[#1F6B52] shadow-sm ring-1 ring-[#E8F3EE] ${compact ? "h-8 w-8" : "h-9 w-9"}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <p className="mt-1.5 max-w-[15rem] text-xs leading-snug text-[#6B7280]">{message}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, accentClass = "bg-[#E8F3EE] text-[#1F6B52]" }) {
  return (
    <div className="mb-3 flex items-start gap-2.5 border-b border-[#EEF0EE]/90 pb-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${accentClass}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-[#1F2933]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p> : null}
      </div>
    </div>
  );
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
  openChatForOrder,
  acceptOrderIntoCurrentTasks,
  tailorChatConversations = [],
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
      const workflow = taskWorkflowMeta(order);
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
        title: TASK_MAP[workflow.internalStatus] || workflow.stepLabel,
        customerName: order.customerName || order.customerId || "",
        customerId: order.customerId,
        item,
        customer: order.customerName || order.customerId || "",
        garment: item || order.garmentType || "",
        due: order.dueDate || order.date,
        status: workflow.internalStatus,
        statusInternal: workflow.internalStatus,
        workflowIndex: workflow.workflowIndex,
        stepLabel: workflow.stepLabel,
        chipLabel: workflow.chipLabel,
        sourceOrder: order,
      };
    });
  }, [orders]);

  const focusCurrentTask = (task, toggleExpand = false) => {
    if (!task?.sourceOrder) return;
    const key = String(task._id ?? task.id ?? "").trim();
    if (key) setActiveOrderId(key);
    if (toggleExpand) {
      setExpandedTaskId((prev) => {
        const prevStr = prev == null ? "" : String(prev).trim();
        return prevStr === key ? null : key;
      });
    } else {
      setExpandedTaskId(key);
    }
  };

  const handleMarkDone = async (task) => {
    try {
      const taskId = String(task?._id ?? task?.id ?? "").trim();
      const order =
        task?.sourceOrder || orders.find((o) => String(o._id ?? o.id ?? "").trim() === taskId);
      if (!order || !taskId) return;

      const { workflowIndex: currentIndex, internalStatus } = resolveOrderWorkflowState(order);
      if (internalStatus === "completed") return;

      const fromIndex =
        internalStatus === "accepted" ? 0 : Math.max(0, Math.min(currentIndex, workflowStages.length - 1));
      const nextIndex = Math.min(fromIndex + 1, workflowStages.length - 1);
      const nextStatus = workflowStages[nextIndex].status;
      if (!nextStatus || nextStatus === internalStatus) return;

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
  const primaryBtn = TD_PRIMARY_BUTTON_CLASS;

  return (
    <div className="space-y-4 sm:space-y-5">
      {notifications.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {notifications.map((note, index) => (
            <motion.div
              key={`${index}-${notificationText(note)}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              className="rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-sm"
            >
              {notificationText(note)}
            </motion.div>
          ))}
        </div>
      ) : null}

      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        className={TD_HERO_CARD}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.06)_38%,transparent_62%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-emerald-200/25 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-teal-100/20 blur-xl"
          aria-hidden
        />
        <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Tailor Studio</p>
            <h1 className="mt-1 font-['Playfair_Display',Georgia,serif] text-xl font-bold tracking-tight text-white sm:text-2xl">
              Welcome Back, {welcomeName}
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              Manage your orders, fittings, and client messages from one place.
            </p>
          </div>
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white shadow-inner backdrop-blur-sm sm:inline-flex">
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
        </div>
      </motion.header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Active Orders", value: displayStats.inProgress, icon: Shirt },
          { label: "Upcoming Fittings", value: upcomingOrders.length, icon: CalendarDays },
          { label: "Pending Approvals", value: displayStats.pending, icon: CheckCircle2 },
          { label: "Client Messages", value: notifications.length, icon: MessageCircle },
        ].map((item, i) => {
          const StatIcon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 * i, ease: [0.25, 0.1, 0.25, 1] }}
              className={`${glassCardCompact} flex items-center gap-3`}
            >
              <span className={`${TD_STAT_ICON} ${STAT_ACCENTS[i % STAT_ACCENTS.length]}`}>
                <StatIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] sm:text-xs">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums leading-none tracking-tight text-[#1F2933] sm:text-2xl">
                  {item.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-4">
        <div className="space-y-4 lg:col-span-8">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <SectionHeader
              icon={ClipboardList}
              title="Current Tasks"
              subtitle="Priority work on your bench"
              accentClass="bg-[#F3EBDD] text-[#8B6914]"
            />
            {tasks.length === 0 ? (
              <EmptyState
                compact
                icon={Inbox}
                message="Your bench is clear. New orders will land here when clients book."
              />
            ) : (
              <div
                className="max-h-[min(28rem,52vh)] overflow-y-auto overflow-x-hidden pr-1 [-webkit-overflow-scrolling:touch] scroll-smooth"
                role="region"
                aria-label="Current tasks (scroll for more)"
              >
                <ul className="space-y-2.5 pb-1">
                  {tasks.map((task) => {
                    const rowKey = String(task._id ?? task.id ?? "").trim();
                    const activeIdx =
                      task.workflowIndex ?? getStatusIndex(task.statusInternal);
                    const isRowActive = rowKey === String(activeOrderId ?? "").trim();
                    const isExpanded =
                      rowKey !== "" && rowKey === String(expandedTaskId ?? "").trim();
                    const atLastStep = activeIdx >= workflowStages.length - 1;
                    return (
                      <li
                        key={rowKey}
                        className={`overflow-hidden rounded-[16px] border transition-all ${
                          isRowActive
                            ? "border-[#1F6B52]/40 bg-[#E8F3EE] shadow-sm"
                            : "border-[#E8EBE9] bg-[#FAFBFA] transition-all duration-200 hover:border-[#D1D5DB] hover:shadow-sm"
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              focusCurrentTask(task, false);
                            }
                          }}
                          onClick={() => focusCurrentTask(task, false)}
                          className="flex w-full flex-col gap-2 p-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-[#1F2933]">
                                {task.customer || task.customerName || "Customer"}
                              </p>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  task.chipLabel === "Accepted"
                                    ? "bg-[#E8F3EE] text-[#1F6B52]"
                                    : "bg-[#F3EBDD] text-[#8B6914]"
                                }`}
                              >
                                {task.chipLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-[#6B7280]">
                              {task.garment || task.item || "Garment"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#1F6B52]">
                              Current step: {task.stepLabel}
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-[#9CA3AF]">
                              Due: {task.due || "—"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                            {!atLastStep ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkDone(task);
                                }}
                                className={primaryBtn}
                              >
                                Mark Done
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                focusCurrentTask(task, true);
                              }}
                              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-bold text-[#1F2933] shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-[#1F6B52]/30 hover:text-[#1F6B52] hover:shadow-md"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                        {isExpanded ? (
                          <div className="space-y-2 border-t border-[#E8EBE9] bg-white/80 px-3 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                              Workflow
                            </p>
                            <ol className="space-y-2">
                              {workflowStages.map((stage, i) => {
                                const isDone = i < activeIdx;
                                const isCurrent = i === activeIdx;
                                return (
                                  <li
                                    key={stage.status}
                                    className="flex items-center gap-2 text-sm text-[#4B5563]"
                                  >
                                    <span className="w-5 text-center" aria-hidden>
                                      {isDone ? "✔" : isCurrent ? "➤" : "○"}
                                    </span>
                                    <span className={isCurrent ? "font-bold text-[#1F6B52]" : ""}>
                                      {stage.label}
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {task.sourceOrder && isOrderAwaitingTailorAccept(task.sourceOrder) ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const oid = String(task._id ?? task.id ?? "").trim();
                                    if (oid) void acceptOrderIntoCurrentTasks?.(oid, task.sourceOrder);
                                  }}
                                  className={primaryBtn}
                                >
                                  Accept order
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkDone(task);
                                }}
                                className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-bold text-[#1F2933] shadow-sm transition hover:bg-[#F6F8F7]"
                              >
                                Mark Done
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <SectionHeader
              icon={Ruler}
              title="Measurements to Review"
              subtitle="Approve or review customer measurements"
            />
            {measurementsCandidates.length > 0 ? (
              <ul className="space-y-3">
                {measurementsCandidates.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center gap-2.5 rounded-[16px] border border-[#E8EBE9] bg-[#FAFBFA] p-2.5 transition-all duration-200 hover:border-[#D1D5DB] hover:shadow-sm sm:p-3"
                  >
                    <img
                      src={DEFAULT_AVATAR}
                      alt=""
                      className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#1F2933]">{order.customerName}</p>
                      <p className="truncate text-xs text-[#6B7280]">
                        {order.garmentType ? order.garmentType : "New measurements"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      {isOrderAwaitingTailorAccept(order) ? (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            const oid = String(order.id ?? order._id ?? "").trim();
                            if (oid) void acceptOrderIntoCurrentTasks?.(oid, order);
                          }}
                          className={primaryBtn}
                        >
                          Accept order
                        </motion.button>
                      ) : null}
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
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={Ruler}
                message="No measurements waiting. New submissions will show up here."
              />
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <SectionHeader
              icon={MessageCircle}
              title="Recent Messages"
              subtitle="Latest client notifications"
              accentClass="bg-[#FCE7F3] text-[#BE185D]"
            />
            <p className="mb-3 text-xs text-[#6B7280] sm:text-sm">
              Open <span className="font-bold text-[#1F2933]">Messages</span> for the full workspace to
              search, filter, and reply to customers.
            </p>
            {notifications.slice(0, 4).length > 0 ? (
              <div className="space-y-2">
                {notifications.slice(0, 4).map((note, index) => {
                  const text = notificationText(note);
                  return (
                    <div
                      key={`${index}-${text}`}
                      className="flex gap-3 rounded-[18px] border border-[#E8EBE9] bg-[#FAFBFA] p-3.5 transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-[#D1D5DB] hover:shadow-sm"
                    >
                      <span
                        className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-[#1F6B52] shadow-[0_0_8px_rgba(31,107,82,0.5)]"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-[#4B5563]">
                          &ldquo;{text.length > 96 ? `${text.slice(0, 96)}…` : text}&rdquo;
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#9CA3AF]">
                          {index === 0 ? "Today" : "Recently"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={MessageCircle} message="No notifications yet. Messages will show here." />
            )}
          </motion.section>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <RecentChatsPreviewCard
            mode="tailor"
            conversations={tailorChatConversations}
            orders={orders}
            messagesPath="/tailor/messages"
            glassCardClass={TD_CHATS_SURFACE}
          />

          <motion.section
            id="tailor-dashboard-orders"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={`${glassCard} scroll-mt-24`}
          >
            <SectionHeader
              icon={Shirt}
              title="Order Overview"
              subtitle="Status breakdown at a glance"
            />
            <div className="mt-1 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
              <ul className="w-full space-y-2.5 text-xs sm:max-w-[12rem] sm:text-sm">
                <li className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-all duration-200 hover:bg-[#FAFBFA]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1F6B52]" />
                  <span className="text-[#6B7280]">
                    In Progress —{" "}
                    <span className="font-bold text-[#1F2933]">{displayStats.inProgress}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-all duration-200 hover:bg-[#FAFBFA]">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-[#6B7280]">
                    Awaiting Approval —{" "}
                    <span className="font-bold text-[#1F2933]">{displayStats.pending}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-all duration-200 hover:bg-[#FAFBFA]">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  <span className="text-[#6B7280]">
                    Completed —{" "}
                    <span className="font-bold text-[#1F2933]">{displayStats.completed}</span>
                  </span>
                </li>
              </ul>
              <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                <div
                  className="absolute inset-0 rounded-full shadow-[inset_0_2px_12px_rgba(15,23,42,0.06)]"
                  style={{ background: donutGradient }}
                />
                <div className="absolute inset-[22%] rounded-full bg-white shadow-inner" />
              </div>
            </div>
            <div className="mt-4 border-t border-[#EEF0EE]/90 pt-4">
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
                className={`${primaryBtn} inline-flex w-full items-center justify-center gap-2 py-2.5`}
              >
                Save &amp; Continue
                <ChevronRight className="h-4 w-4" aria-hidden />
              </motion.button>
            </div>
          </motion.section>

          <motion.section
            id="td-upcoming"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className={glassCard}
          >
            <SectionHeader
              icon={Calendar}
              title="Calendar Schedule"
              subtitle="Next deadlines"
              accentClass="bg-[#E0F2FE] text-[#0369A1]"
            />
            {calendarPreview.length > 0 ? (
              <ul className="space-y-3">
                {calendarPreview.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-[#E8EBE9] bg-[#FAFBFA] px-3 py-2.5 text-sm transition-all duration-200 hover:border-[#D1D5DB] hover:shadow-sm"
                  >
                    <span className="font-bold text-[#1F2933]">{o.customerName}</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280]">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {o.dueDate || o.date}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Calendar} message="No scheduled items yet. Upcoming fittings appear here." />
            )}
            <button
              type="button"
              onClick={() => document.getElementById("td-upcoming")?.scrollIntoView({ behavior: "smooth" })}
              className={`${TD_GHOST_BTN} mt-4 w-full py-2 text-xs active:scale-[0.99] sm:text-sm`}
            >
              View Calendar
            </button>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
