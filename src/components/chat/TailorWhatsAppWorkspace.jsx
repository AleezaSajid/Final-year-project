import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  Video,
} from "lucide-react";
import { socket } from "../../socket.js";
import {
  displayChatActorName,
  isOrderAwaitingTailorAccept,
  isOrderChatEnabled,
  isOrderEligibleForChat,
  normalizeConversationId,
} from "../../chatUtils.js";
import { resolveOrderWorkflowState } from "../../tailorDashboard/constants.js";
import { resolveConversationPeers } from "../../utils/orderChatParticipants.js";
import OrderChatThread from "./OrderChatThread.jsx";
import { mergeSidebarRowsWithInjected } from "./workspaceSidebarMerge.js";
import {
  avatarClassName,
  chatInitials,
  chatStatusBadge,
  shortOrderId,
  sidebarNameClass,
  sidebarPreviewClass,
  sidebarRowClassName,
  sidebarTimeClass,
  sidebarUnreadClass,
} from "./chatWorkspaceUi.js";

function conversationRowCompleted(conv, orderList) {
  if (conv?.status === "completed") return true;
  const oid = normalizeConversationId(conv?.orderId ?? conv?.conversationId ?? "");
  if (!oid) return false;
  const o = orderList.find((x) => String(x.id ?? x._id) === oid);
  if (!o) return false;
  return resolveOrderWorkflowState(o).internalStatus === "completed";
}

function formatConversationTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildOrderStubFromConv(conv, activeTailorShopId) {
  const oid = normalizeConversationId(conv.orderId ?? conv.conversationId ?? "");
  return {
    id: oid,
    _id: oid,
    customerId: conv.customerId,
    customerName: conv.customerName,
    garmentType: conv.garmentType,
    tailorId: conv.tailorId || activeTailorShopId,
    status: conv.status || "processing",
  };
}

/**
 * WhatsApp Web–style 3-panel layout for tailor dashboard. Uses existing openChatForOrder + OrderChatThread (same sockets).
 */
export default function TailorWhatsAppWorkspace({
  tailorChatConversations = [],
  orders = [],
  openChatForOrder,
  acceptOrderIntoCurrentTasks,
  activeConversationId = "",
  activeChatCustomer = { id: "", name: "Customer" },
  activeTailorShopId = "",
  setActiveOrderId,
  fullPage = false,
}) {
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState("list");

  const normalizedActive = normalizeConversationId(activeConversationId);

  const activeOrder = useMemo(() => {
    if (!normalizedActive) return null;
    return orders.find((o) => String(o.id ?? o._id) === normalizedActive) || null;
  }, [orders, normalizedActive]);

  /** Ensures the open order chat always has a sidebar row (API list may be empty or not yet hydrated). */
  const injectedSidebarRow = useMemo(() => {
    if (!normalizedActive || !activeTailorShopId) return null;
    const fromApi = tailorChatConversations.find(
      (c) => normalizeConversationId(c.orderId ?? c.conversationId) === normalizedActive
    );
    const customerId =
      fromApi?.customerId || activeOrder?.customerId || activeChatCustomer?.id || "";
    if (!customerId) return null;
    return {
      orderId: normalizedActive,
      conversationId: normalizedActive,
      customerId,
      customerName:
        fromApi?.customerName || activeOrder?.customerName || activeChatCustomer?.name || "Customer",
      tailorId: fromApi?.tailorId || activeOrder?.tailorId || activeTailorShopId,
      garmentType: activeOrder?.garmentType || fromApi?.garmentType || "",
      lastMessage: fromApi?.lastMessage || "",
      lastMessageAt:
        fromApi?.lastMessageAt ||
        activeOrder?.updatedAt ||
        activeOrder?.createdAt ||
        new Date().toISOString(),
      unreadTailor: fromApi != null ? Number(fromApi.unreadTailor || 0) : 0,
      status: fromApi?.status || "active",
    };
  }, [
    normalizedActive,
    activeTailorShopId,
    activeChatCustomer,
    activeOrder,
    tailorChatConversations,
  ]);

  const sidebarRows = useMemo(
    () => mergeSidebarRowsWithInjected(tailorChatConversations, injectedSidebarRow),
    [tailorChatConversations, injectedSidebarRow]
  );

  const activeRow = useMemo(() => {
    if (!normalizedActive) return null;
    return (
      sidebarRows.find(
        (c) => normalizeConversationId(c.orderId ?? c.conversationId) === normalizedActive
      ) || null
    );
  }, [sidebarRows, normalizedActive]);

  const peers = useMemo(
    () =>
      activeRow && activeTailorShopId
        ? resolveConversationPeers({ row: activeRow, currentUserId: activeTailorShopId, mode: "tailor" })
        : null,
    [activeRow, activeTailorShopId]
  );

  const peerCustomerName = peers?.peerDisplayName || activeChatCustomer?.name || "Customer";
  const headerOrderShort = shortOrderId(normalizedActive);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sidebarRows.filter((conv) => {
      const oid = normalizeConversationId(conv.orderId ?? conv.conversationId ?? "");
      const isSelected = Boolean(normalizedActive && oid === normalizedActive);
      const unread = Math.max(0, Number(conv.unreadTailor || 0));
      const done = conversationRowCompleted(conv, orders);
      if (!isSelected) {
        if (filter === "unread" && unread === 0) return false;
        if (filter === "active" && done) return false;
        if (filter === "completed" && !done) return false;
      }
      if (!q) return true;
      if (isSelected) return true;
      const order = orders.find((o) => String(o.id ?? o._id) === oid);
      const name = String(
        displayChatActorName(conv.customerName, order?.customerName, conv.customerId) || "customer"
      ).toLowerCase();
      const preview = String(conv.lastMessage || "").toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [sidebarRows, orders, filter, search, normalizedActive]);

  useEffect(() => {
    const api = Array.isArray(tailorChatConversations) ? tailorChatConversations : [];
    const activeInFetched = Boolean(
      normalizedActive &&
        api.some((r) => normalizeConversationId(r?.orderId ?? r?.conversationId) === normalizedActive)
    );
    console.log("[Workspace Sidebar]", {
      role: "tailor",
      fetchedCount: api.length,
      renderedMergedCount: sidebarRows.length,
      activeConversationId: normalizedActive || null,
      filteredCount: filteredConversations.length,
      activeRowInFetchedList: activeInFetched,
      syntheticRowForActive: Boolean(injectedSidebarRow),
      filter,
      searchSnippet: search.trim().slice(0, 32),
    });
  }, [
    tailorChatConversations,
    sidebarRows.length,
    normalizedActive,
    filteredConversations.length,
    injectedSidebarRow,
    filter,
    search,
  ]);

  const chatStub = useMemo(() => {
    if (!normalizedActive || !activeTailorShopId) return null;
    if (activeOrder) return activeOrder;
    if (activeRow) return buildOrderStubFromConv(activeRow, activeTailorShopId);
    return null;
  }, [normalizedActive, activeOrder, activeRow, activeTailorShopId]);

  const chatUnlocked = Boolean(
    chatStub && isOrderChatEnabled(chatStub, { conversationStatus: activeRow?.status })
  );
  const headerBadge = chatStatusBadge(activeRow, chatStub || activeOrder);
  const awaitingAccept = Boolean(chatStub && isOrderAwaitingTailorAccept(chatStub));
  const canSelect = Boolean(chatStub && peers?.customerId);

  const selectConversation = useCallback(
    (conv) => {
      const oid = normalizeConversationId(conv.orderId ?? conv.conversationId ?? "");
      const order = orders.find((o) => String(o.id ?? o._id) === oid);
      const stub = order || buildOrderStubFromConv(conv, activeTailorShopId);
      if (!stub || !conv.customerId) return;
      const locked = !isOrderEligibleForChat(stub);
      openChatForOrder?.(stub, { allowLocked: locked });
      setMobilePanel("chat");
    },
    [orders, openChatForOrder, activeTailorShopId]
  );

  const handleAcceptActiveOrder = useCallback(async () => {
    const oid = normalizeConversationId(normalizedActive);
    if (!oid || !acceptOrderIntoCurrentTasks || acceptBusy) return;
    setAcceptBusy(true);
    try {
      await acceptOrderIntoCurrentTasks(oid, chatStub || activeOrder);
    } finally {
      setAcceptBusy(false);
    }
  }, [normalizedActive, acceptOrderIntoCurrentTasks, acceptBusy, chatStub, activeOrder]);

  const filterBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        filter === id
          ? "bg-[#00a884] text-white shadow-sm"
          : "bg-slate-200/80 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );

  const layoutMinH = fullPage ? "min-h-[calc(100dvh-9rem)] h-full" : "min-h-[min(720px,78vh)]";

  return (
    <section
      id="tailor-chat-workspace"
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-[#f0f2f5] shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] ${
        fullPage ? "h-full min-h-0" : "scroll-mt-24"
      }`}
      aria-label="Order messages"
    >
      <div className={`flex w-full flex-col lg:flex-row ${layoutMinH}`}>
        {/* Left — conversation list */}
        <aside
          className={`flex w-full shrink-0 flex-col border-slate-200/80 bg-white lg:w-[320px] lg:max-w-[320px] lg:border-r ${
            mobilePanel === "chat" || mobilePanel === "detail" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="shrink-0 border-b border-slate-100 bg-[#f0f2f5] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or start new chat"
                className="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]/30"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filterBtn("all", "All")}
              {filterBtn("unread", "Unread")}
              {filterBtn("active", "Active")}
              {filterBtn("completed", "Completed")}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No conversations match.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredConversations.map((conv) => {
                  const oid = normalizeConversationId(conv.orderId ?? conv.conversationId ?? "");
                  const order = orders.find((o) => String(o.id ?? o._id) === oid);
                  const cust = displayChatActorName(
                    conv.customerName,
                    order?.customerName,
                    conv.customerId
                  ) || "Customer";
                  const preview =
                    (conv.lastMessage && String(conv.lastMessage).trim()) || "Start conversation";
                  const ts = conv.lastMessageAt || conv.updatedAt;
                  const timeLabel = formatConversationTime(ts) || "—";
                  const unread = Math.max(0, Number(conv.unreadTailor || 0));
                  const selected = oid && oid === normalizedActive;
                  return (
                    <li key={oid ? `${oid}-${cust}` : `${conv.conversationId || "c"}-${cust}`}>
                      <button
                        type="button"
                        onClick={() => selectConversation(conv)}
                        className={sidebarRowClassName(selected)}
                      >
                        <div className={avatarClassName("md")} aria-hidden>
                          {chatInitials(cust)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={sidebarNameClass}>{cust}</span>
                            <span className={sidebarTimeClass}>{timeLabel}</span>
                          </div>
                          {shortOrderId(oid) ? (
                            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                              {shortOrderId(oid)}
                            </p>
                          ) : null}
                          <div className="mt-1 flex items-center gap-2">
                            <p className={sidebarPreviewClass}>{preview}</p>
                            {unread > 0 ? (
                              <span className={sidebarUnreadClass}>
                                {unread > 99 ? "99+" : unread}
                              </span>
                            ) : null}
                          </div>
                          <span
                            className={`mt-1.5 inline-block ${chatStatusBadge(conv, order).className}`}
                          >
                            {chatStatusBadge(conv, order).label}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Center — active thread */}
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[#e5ddd5] ${
            mobilePanel === "list" ? "hidden lg:flex" : "flex"
          }`}
        >
          {normalizedActive ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-[#f0f2f5] px-2 py-2 sm:px-4">
                <button
                  type="button"
                  className="rounded-full p-2 text-slate-600 hover:bg-slate-200/80 lg:hidden"
                  aria-label="Back to conversations"
                  onClick={() => setMobilePanel("list")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className={avatarClassName("sm")} aria-hidden>
                  {chatInitials(peerCustomerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-bold text-slate-900">{peerCustomerName}</p>
                    <span className={`shrink-0 ${headerBadge.className}`}>
                      {headerBadge.label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {headerOrderShort ? `Order ${headerOrderShort}` : "Order chat"}
                    {activeOrder?.garmentType ? ` · ${String(activeOrder.garmentType)}` : ""}
                    {" · "}
                    <span className={socket.connected ? "text-emerald-700" : "text-amber-700"}>
                      {socket.connected ? "Online" : "Connecting…"}
                    </span>
                  </p>
                </div>
                <div className="hidden items-center gap-0.5 sm:flex">
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-200/80"
                    aria-label="Voice call"
                    disabled
                  >
                    <Video className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-200/80"
                    aria-label="Phone"
                    disabled
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-200/80"
                    aria-label="More"
                    disabled
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
                <button
                  type="button"
                  className="hidden rounded-full p-2 text-slate-500 hover:bg-slate-200/80 xl:inline-flex"
                  aria-label="Profile panel"
                  onClick={() => setMobilePanel("detail")}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
              </header>
              {awaitingAccept ? (
                <div className="shrink-0 border-b border-amber-200/90 bg-gradient-to-r from-amber-50 to-amber-50/80 px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-amber-950">Accept this order to unlock chat</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/85">
                    The customer assigned you on the map. Accept to start messaging.
                  </p>
                  <button
                    type="button"
                    disabled={acceptBusy}
                    onClick={() => void handleAcceptActiveOrder()}
                    className="mt-3 rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                  >
                    {acceptBusy ? "Accepting…" : "Accept order"}
                  </button>
                </div>
              ) : null}
              <OrderChatThread
                isActive={Boolean(normalizedActive && activeTailorShopId && peers?.conversationId && canSelect)}
                isChatEnabled={chatUnlocked}
                mode="tailor"
                senderId={peers?.senderId}
                receiverId={peers?.receiverId}
                customerId={peers?.customerId}
                tailorId={peers?.tailorId}
                orderId={peers?.orderId}
                peerDisplayName={peerCustomerName}
                conversationId={normalizedActive}
                theme="whatsapp"
                className="min-h-0 flex-1"
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-full bg-white/80 p-6 shadow-sm">
                <MessageCircle className="h-14 w-14 text-[#00a884]" strokeWidth={1.25} aria-hidden />
              </div>
              <h3 className="text-lg font-medium text-slate-700">SewServe Messages</h3>
              <p className="max-w-sm text-sm text-slate-500">
                Select a conversation on the left to view order chat. Realtime messages use your existing connection.
              </p>
            </div>
          )}
        </div>

        {/* Right — profile / order */}
        <aside
          className={`w-full shrink-0 border-slate-200/80 bg-white xl:w-[300px] xl:max-w-[300px] xl:border-l xl:flex xl:flex-col ${
            mobilePanel === "detail"
              ? "flex max-h-[min(70vh,520px)] flex-col overflow-hidden"
              : "hidden"
          }`}
        >
          {normalizedActive && activeOrder ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex shrink-0 flex-col items-center border-b border-slate-100 bg-[#f0f2f5] px-4 py-6">
                <button
                  type="button"
                  className="mb-4 self-start rounded-full p-2 text-slate-600 hover:bg-slate-200/80 xl:hidden"
                  aria-label="Back to chat"
                  onClick={() => setMobilePanel("chat")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className={avatarClassName("lg", "h-28 w-28 text-xl shadow-md ring-4 ring-white")} aria-hidden>
                  {chatInitials(peerCustomerName)}
                </div>
                <h3 className="mt-4 text-center text-xl font-semibold text-slate-900">{peerCustomerName}</h3>
                <p className="mt-1 text-center text-sm text-slate-500">
                  {activeOrder?.garmentType ? String(activeOrder.garmentType) : "Order conversation"}
                </p>
                <p className={`mt-2 text-xs font-medium ${socket.connected ? "text-emerald-700" : "text-amber-700"}`}>
                  {socket.connected ? "Online" : "Connecting…"}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">About</p>
                  <p className="mt-1 text-sm text-slate-600">Order messaging for this customer is tied to the selected order.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Summary</dt>
                      <dd className="text-right text-slate-900">
                        {activeOrder.garmentType || "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Status</dt>
                      <dd className="text-right text-slate-900">
                        {resolveOrderWorkflowState(activeOrder).internalStatus.replace(/_/g, " ")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Created</dt>
                      <dd className="text-right text-slate-900">
                        {activeOrder.createdAt
                          ? formatConversationTime(activeOrder.createdAt)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOrderId?.(String(activeOrder.id ?? activeOrder._id ?? normalizedActive));
                      window.requestAnimationFrame(() => {
                        document.getElementById("tailor-dashboard-orders")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      });
                    }}
                    className="mt-4 w-full rounded-xl bg-[#00a884] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#008f6f]"
                  >
                    View order
                  </button>
                </div>
              </div>
            </div>
          ) : normalizedActive ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-slate-500">
              <p>Order details will appear when this conversation matches an order in your list.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
