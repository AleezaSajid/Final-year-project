import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardList, Inbox, Package } from "lucide-react";
import {
  formatStatusLabel,
  getStatusIndex,
  resolveOrderWorkflowState,
  workflowStages,
} from "../constants";
import {
  getPriorityScore,
  isTailorCurrentTaskOrder,
  isTailorMeasurementReviewOrder,
} from "../../utils/workflowEngine.js";
import { isOrderAwaitingTailorAccept, isOrderRejected } from "../../chatUtils.js";
import {
  TD_GLASS_CARD,
  TD_HERO_CARD,
  TD_PRIMARY_BUTTON_CLASS,
  TD_REJECT_BUTTON_CLASS,
} from "../tailorDashboardClassNames";
import RejectOrderModal from "./RejectOrderModal.jsx";

function orderRowId(order) {
  return String(order?._id ?? order?.id ?? "").trim();
}

function orderGarment(order) {
  if (typeof order?.garmentType === "string" && order.garmentType.trim()) {
    return order.garmentType.trim();
  }
  const nested = order?.orderPayload?.garment?.type;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return "Garment";
}

function orderWorkflowMeta(order) {
  const { internalStatus, workflowIndex } = resolveOrderWorkflowState(order);
  const step = workflowStages[workflowIndex] || workflowStages[0];
  const isFreshAccept =
    Boolean(order?.acceptedAt) &&
    (internalStatus === "pending" || internalStatus === "accepted");
  return {
    internalStatus,
    workflowIndex,
    stepLabel: step?.label || formatStatusLabel(internalStatus),
    chipLabel: isOrderRejected(order)
      ? "Declined"
      : isFreshAccept
        ? "Accepted"
        : internalStatus === "completed"
          ? "Completed"
          : isOrderAwaitingTailorAccept(order)
            ? "Awaiting approval"
            : "In progress",
  };
}

function bucketTailorOrders(orders) {
  const pending = [];
  const inProgress = [];
  const completed = [];
  const rejected = [];

  for (const order of orders) {
    const { internalStatus } = resolveOrderWorkflowState(order);
    if (isOrderRejected(order)) {
      rejected.push(order);
      continue;
    }
    if (internalStatus === "completed") {
      completed.push(order);
      continue;
    }
    if (isTailorMeasurementReviewOrder(order)) {
      pending.push(order);
      continue;
    }
    if (isTailorCurrentTaskOrder(order)) {
      inProgress.push(order);
      continue;
    }
  }

  const byNewest = (a, b) =>
    new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime();

  pending.sort(byNewest);
  inProgress.sort((a, b) => getPriorityScore(a) - getPriorityScore(b));
  completed.sort(byNewest);
  rejected.sort((a, b) => {
    const ta = new Date(a.rejectedAt || a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.rejectedAt || b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  return { pending, inProgress, completed, rejected };
}

function SectionBlock({ title, subtitle, count, children, emptyMessage, icon: Icon }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className={TD_GLASS_CARD}
    >
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-[#EEF0EE]/90 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3EBDD] text-[#8B6914] shadow-sm">
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#1F2933]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p> : null}
          </div>
        </div>
        <span className="rounded-full bg-[#E8F3EE] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#1F6B52]">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#E5E7EB]/90 bg-gradient-to-b from-[#FAFBFA] to-[#F4F7F5] px-3 py-5 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3EBDD]/90 text-[#1F6B52] shadow-sm ring-1 ring-[#E8F3EE]">
            <Inbox className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <p className="mt-1.5 max-w-[16rem] text-xs leading-snug text-[#6B7280]">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </motion.section>
  );
}

function OrderRow({
  order,
  showMarkDone,
  expandedId,
  onToggleExpand,
  onMarkDone,
  onAccept,
  onReject,
  setActiveOrderId,
}) {
  const rowKey = orderRowId(order);
  const meta = orderWorkflowMeta(order);
  const activeIdx = meta.workflowIndex ?? getStatusIndex(meta.internalStatus);
  const isExpanded = rowKey !== "" && rowKey === String(expandedId ?? "").trim();
  const atLastStep = activeIdx >= workflowStages.length - 1;
  const customerName = order.customerName || order.customerId || "Customer";

  return (
    <li
      className={`overflow-hidden rounded-[16px] border transition-all ${
        isExpanded
          ? "border-[#1F6B52]/40 bg-[#E8F3EE] shadow-sm"
          : "border-[#E8EBE9] bg-[#FAFBFA] hover:border-[#D1D5DB] hover:shadow-sm"
      }`}
    >
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#1F2933]">{customerName}</p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isOrderRejected(order)
                  ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80"
                  : "bg-[#E8F3EE] text-[#1F6B52]"
              }`}
            >
              {meta.chipLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#6B7280]">{orderGarment(order)}</p>
          <p className="mt-1 text-xs font-semibold text-[#1F6B52]">
            Current step: {meta.stepLabel}
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#9CA3AF]">
            Due: {order.dueDate || order.date || "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isOrderAwaitingTailorAccept(order) ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (rowKey) void onAccept?.(rowKey, order);
                }}
                className={TD_PRIMARY_BUTTON_CLASS}
              >
                Accept order
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rowKey) onReject?.(rowKey, order);
                }}
                className={TD_REJECT_BUTTON_CLASS}
              >
                Reject order
              </button>
            </>
          ) : null}
          {showMarkDone && !atLastStep ? (
            <button
              type="button"
              onClick={() => void onMarkDone?.(order)}
              className={TD_PRIMARY_BUTTON_CLASS}
            >
              Mark Done
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (rowKey) setActiveOrderId?.(rowKey);
              onToggleExpand?.(rowKey);
            }}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-bold text-[#1F2933] shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-[#1F6B52]/30 hover:text-[#1F6B52] hover:shadow-md"
          >
            View Details
          </button>
        </div>
      </div>
      {isExpanded ? (
        <div className="space-y-2 border-t border-[#E8EBE9] bg-white/80 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Workflow</p>
          <ol className="space-y-2">
            {workflowStages.map((stage, i) => {
              const isDone = i < activeIdx;
              const isCurrent = i === activeIdx;
              return (
                <li key={stage.status} className="flex items-center gap-2 text-sm text-[#4B5563]">
                  <span className="w-5 text-center" aria-hidden>
                    {isDone ? "✔" : isCurrent ? "➤" : "○"}
                  </span>
                  <span className={isCurrent ? "font-bold text-[#1F6B52]" : ""}>{stage.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </li>
  );
}

export default function TdTailorOrdersList({
  tailorOrders = [],
  updateOrderStatus,
  acceptOrderIntoCurrentTasks,
  rejectOrderFromPending,
  navigate,
  setActiveOrderId,
  fetchOrders,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  useEffect(() => {
    const onRefresh = () => {
      void fetchOrders?.();
    };
    window.addEventListener("sewserve:orders-refresh", onRefresh);
    return () => window.removeEventListener("sewserve:orders-refresh", onRefresh);
  }, [fetchOrders]);

  const { pending, inProgress, completed, rejected } = useMemo(
    () => bucketTailorOrders(Array.isArray(tailorOrders) ? tailorOrders : []),
    [tailorOrders]
  );

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget?.id || !rejectOrderFromPending) return;
    setRejectBusy(true);
    try {
      const ok = await rejectOrderFromPending(rejectTarget.id, rejectTarget.order, reason);
      if (ok) setRejectTarget(null);
    } finally {
      setRejectBusy(false);
    }
  };

  const handleToggleExpand = (rowKey) => {
    setExpandedId((prev) => {
      const prevStr = prev == null ? "" : String(prev).trim();
      return prevStr === rowKey ? null : rowKey;
    });
  };

  const handleMarkDone = async (order) => {
    try {
      const taskId = orderRowId(order);
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

  const renderList = (list, showMarkDone) => (
    <ul className="space-y-2.5">
      {list.map((order) => (
        <OrderRow
          key={orderRowId(order) || order.customerName}
          order={order}
          showMarkDone={showMarkDone}
          expandedId={expandedId}
          onToggleExpand={handleToggleExpand}
          onMarkDone={handleMarkDone}
          onAccept={acceptOrderIntoCurrentTasks}
          onReject={(rowKey, order) =>
            setRejectTarget({
              id: rowKey,
              order,
              label: `${order?.customerName || "Customer"}'s ${orderGarment(order)} request`,
            })
          }
          setActiveOrderId={setActiveOrderId}
        />
      ))}
    </ul>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <RejectOrderModal
        open={Boolean(rejectTarget)}
        orderLabel={rejectTarget?.label || "this request"}
        busy={rejectBusy}
        onClose={() => !rejectBusy && setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
      />
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        className={TD_HERO_CARD}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Tailor Studio</p>
        <h1 className="mt-1 font-['Playfair_Display',Georgia,serif] text-xl font-bold tracking-tight text-white sm:text-2xl">
          Orders
        </h1>
        <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
          Review requests, track in-progress work, and browse completed orders.
        </p>
      </motion.header>

      <SectionBlock
        title="Awaiting approval"
        subtitle="New requests assigned to your shop"
        count={pending.length}
        icon={ClipboardList}
        emptyMessage="No orders waiting for your approval."
      >
        {renderList(pending, false)}
      </SectionBlock>

      <SectionBlock
        title="In progress"
        subtitle="Accepted orders on your bench"
        count={inProgress.length}
        icon={Package}
        emptyMessage="No active orders. Accepted work appears here."
      >
        {renderList(inProgress, true)}
      </SectionBlock>

      <SectionBlock
        title="Completed"
        subtitle="Delivered and finished orders"
        count={completed.length}
        icon={CheckCircle2}
        emptyMessage="Completed orders will appear here."
      >
        {renderList(completed, false)}
      </SectionBlock>

      <SectionBlock
        title="Rejected requests"
        subtitle="Declined customer requests"
        count={rejected.length}
        icon={Inbox}
        emptyMessage="Declined requests will appear here for your records."
      >
        {renderList(rejected, false)}
      </SectionBlock>
    </div>
  );
}
