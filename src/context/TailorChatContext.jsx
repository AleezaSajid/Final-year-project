import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { ensureSocketThen, socket } from "../socket.js";
import {
  dedupeConversationsByOrderId,
  isOrderHiddenFromTailorChatList,
  logConversationRowsValidation,
  messageBelongsToOrderChat,
  normalizeChatId,
  normalizeConversationId,
} from "../chatUtils.js";
import { resolveLoggedInTailorShopId } from "../utils/chatIdentity.js";
import { getApiBaseUrl } from "../api/client.js";
import {
  getCachedConversations,
  setCachedConversations,
} from "../utils/recentConversationsCache.js";

const TailorChatContext = createContext(null);

function sortTailorConversationsDesc(rows) {
  const deduped = dedupeConversationsByOrderId(rows);
  return [...deduped].sort((a, b) => {
    const ta = new Date(a?.lastMessageAt || a?.updatedAt || 0).getTime();
    const tb = new Date(b?.lastMessageAt || b?.updatedAt || 0).getTime();
    return tb - ta;
  });
}

function tailorConvRowIndex(list, rawId) {
  const n = normalizeConversationId(rawId);
  if (!n) return -1;
  return list.findIndex((r) => normalizeConversationId(r?.orderId ?? r?.conversationId) === n);
}

function isTailorDashboardPath(pathname) {
  return pathname === "/tailor/dashboard" || pathname === "/dashboard";
}

export function TailorChatProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const activeTailorShopId = useMemo(() => resolveLoggedInTailorShopId(user), [user]);

  const [tailorChatConversations, setTailorChatConversations] = useState([]);
  const [tailorConversationsLoading, setTailorConversationsLoading] = useState(true);
  const tailorReconcileRefetchAtRef = useRef(0);
  const tailorConversationsFetchedForRef = useRef("");
  const fetchTailorConversationsRef = useRef(async () => {});
  const scheduleTailorConversationsReconcileRef = useRef(() => {});
  const ordersRef = useRef([]);

  const filterConversationsByOrders = useCallback((list, orderList) => {
    const rows = Array.isArray(list) ? list : [];
    const orders = Array.isArray(orderList) ? orderList : [];
    return rows.filter((row) => {
      const oid = normalizeConversationId(row?.orderId ?? row?.conversationId);
      if (!oid) return false;
      const order = orders.find((o) => String(o?.id ?? o?._id ?? "").trim() === oid);
      return !isOrderHiddenFromTailorChatList(order, row);
    });
  }, []);

  const fetchTailorConversations = useCallback(
    async (options = {}) => {
      const { force = false, silent = false } = options;
      const tid = String(activeTailorShopId || "").trim();
      if (!tid || user?.role !== "tailor") return;
      const cached = getCachedConversations("tailor", tid);
      if (!force && cached?.length) {
        setTailorConversationsLoading(false);
        return;
      }
      if (!silent && !cached?.length) setTailorConversationsLoading(true);
      const base = getApiBaseUrl();
      if (!base) return;
      try {
        const res = await fetch(`${base}/conversations/tailor/${encodeURIComponent(tid)}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          console.warn("[ChatSync tailor] Conversation fetch failed: Forbidden", { tid, data });
        }
        const list = Array.isArray(data?.conversations) ? data.conversations : [];
        logConversationRowsValidation(list, "tailor fetch");
        const visible = filterConversationsByOrders(list, ordersRef.current);
        const sorted = sortTailorConversationsDesc(visible);
        setTailorChatConversations(sorted);
        setCachedConversations("tailor", tid, sorted);
      } catch (e) {
        console.error("[ChatSync tailor] fetch conversations failed", e);
      } finally {
        if (!silent) setTailorConversationsLoading(false);
      }
    },
    [activeTailorShopId, filterConversationsByOrders, user?.role]
  );

  const scheduleTailorConversationsReconcile = useCallback((reason) => {
    const now = Date.now();
    if (now - tailorReconcileRefetchAtRef.current < 1600) return;
    tailorReconcileRefetchAtRef.current = now;
    void fetchTailorConversationsRef.current({ force: true, silent: true });
  }, []);

  fetchTailorConversationsRef.current = fetchTailorConversations;
  scheduleTailorConversationsReconcileRef.current = scheduleTailorConversationsReconcile;

  useEffect(() => {
    const tid = String(activeTailorShopId || "").trim();
    if (!tid || user?.role !== "tailor") {
      setTailorConversationsLoading(false);
      return;
    }
    if (tailorConversationsFetchedForRef.current === tid) return;
    tailorConversationsFetchedForRef.current = tid;

    const cached = getCachedConversations("tailor", tid);
    if (cached?.length) {
      setTailorChatConversations(cached);
      setTailorConversationsLoading(false);
      void fetchTailorConversations({ force: true, silent: true });
      return;
    }
    void fetchTailorConversations({ force: true });
  }, [activeTailorShopId, fetchTailorConversations, user?.role]);

  useEffect(() => {
    if (user?.role !== "tailor" || !isTailorDashboardPath(location.pathname)) return;
    const tid = String(activeTailorShopId || "").trim();
    if (!tid) return;
    void fetchTailorConversationsRef.current({ force: true, silent: true });
  }, [location.pathname, activeTailorShopId, user?.role]);

  useEffect(() => {
    const tid = String(activeTailorShopId || "").trim();
    if (!tid || tailorChatConversations.length === 0) return;
    setCachedConversations("tailor", tid, tailorChatConversations);
  }, [activeTailorShopId, tailorChatConversations]);

  useEffect(() => {
    if (user?.role !== "tailor" || !activeTailorShopId) return undefined;
    const joinRoom = () => {
      const room = String(activeTailorShopId).trim();
      if (!room) return;
      socket.emit("join_user", { userId: room });
    };
    ensureSocketThen(joinRoom);
    socket.on("connect", joinRoom);
    return () => socket.off("connect", joinRoom);
  }, [user?.role, activeTailorShopId]);

  useEffect(() => {
    if (user?.role !== "tailor" || !activeTailorShopId) return undefined;

    const onConversationUpdated = (payload) => {
      const nCid = normalizeConversationId(payload?.conversationId);
      if (!nCid) return;
      setTailorChatConversations((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const i = tailorConvRowIndex(list, nCid);
        const base =
          i >= 0
            ? { ...list[i] }
            : {
                orderId: nCid,
                conversationId: nCid,
                tailorId: normalizeChatId(payload?.tailorId) || String(activeTailorShopId).trim(),
                customerId: normalizeChatId(payload?.customerId) || "",
                lastMessage: "",
                lastMessageAt: null,
                unreadCustomer: 0,
                unreadTailor: 0,
                status: "active",
              };
        const merged = {
          ...base,
          ...payload,
          conversationId: nCid,
          orderId: nCid,
        };
        if (payload.lastMessage != null) merged.lastMessage = payload.lastMessage;
        if (payload.lastMessageAt != null) merged.lastMessageAt = payload.lastMessageAt;
        if (payload.unreadCustomer != null) merged.unreadCustomer = payload.unreadCustomer;
        if (payload.unreadTailor != null) merged.unreadTailor = payload.unreadTailor;
        if (payload.status != null) merged.status = payload.status;
        if (normalizeChatId(payload?.tailorId)) merged.tailorId = normalizeChatId(payload.tailorId);
        if (normalizeChatId(payload?.customerId)) merged.customerId = normalizeChatId(payload.customerId);
        if (i >= 0) list.splice(i, 1);
        list.unshift(merged);
        return sortTailorConversationsDesc(list);
      });
    };

    const onMessageSidebar = (message) => {
      const nCid = normalizeConversationId(message?.conversationId);
      if (!nCid) return;
      setTailorChatConversations((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const i = list.findIndex((r) => {
          const rid = normalizeConversationId(r?.orderId ?? r?.conversationId);
          return rid && (rid === nCid || messageBelongsToOrderChat(message, rid));
        });
        if (i < 0) {
          const text = String(message?.content ?? "").trim();
          const stub = {
            orderId: nCid,
            conversationId: nCid,
            tailorId: String(activeTailorShopId || "").trim(),
            customerId: normalizeChatId(message?.senderId) || "",
            lastMessage: text ? text.slice(0, 400) : "",
            lastMessageAt: message?.timestamp || new Date().toISOString(),
            unreadTailor: 0,
            unreadCustomer: 0,
            status: "active",
          };
          list.unshift(stub);
          scheduleTailorConversationsReconcileRef.current("message_received_missing_row");
          return sortTailorConversationsDesc(list);
        }
        const row = { ...list[i] };
        const text = String(message?.content ?? "").trim();
        if (text) row.lastMessage = text.slice(0, 400);
        row.lastMessageAt = message?.timestamp || new Date().toISOString();
        list.splice(i, 1);
        list.unshift(row);
        return sortTailorConversationsDesc(list);
      });
    };

    const onNewNotification = (payload) => {
      if (payload?.type !== "new_message") return;
      if (normalizeChatId(payload?.senderId) === normalizeChatId(activeTailorShopId)) return;
      const nCid = normalizeConversationId(payload?.conversationId);
      if (!nCid) return;
      setTailorChatConversations((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const i = tailorConvRowIndex(list, nCid);
        if (i < 0) {
          list.unshift({
            orderId: nCid,
            conversationId: nCid,
            tailorId: String(activeTailorShopId || "").trim(),
            customerId: normalizeChatId(payload?.senderId) || "",
            lastMessage: String(payload?.content || "").slice(0, 400),
            lastMessageAt: payload?.timestamp || new Date().toISOString(),
            unreadTailor: Math.max(0, Number(payload?.unreadTailor ?? 1)),
            unreadCustomer: Math.max(0, Number(payload?.unreadCustomer ?? 0)),
            status: "active",
          });
          scheduleTailorConversationsReconcileRef.current("new_notification_missing_row");
          return sortTailorConversationsDesc(list);
        }
        const row = { ...list[i] };
        row.lastMessage = String(payload?.content || "").slice(0, 400);
        row.lastMessageAt = payload?.timestamp || new Date().toISOString();
        list.splice(i, 1);
        list.unshift(row);
        return sortTailorConversationsDesc(list);
      });
    };

    socket.on("conversation:updated", onConversationUpdated);
    socket.on("message_received", onMessageSidebar);
    socket.on("new_notification", onNewNotification);
    return () => {
      socket.off("conversation:updated", onConversationUpdated);
      socket.off("message_received", onMessageSidebar);
      socket.off("new_notification", onNewNotification);
    };
  }, [activeTailorShopId, user?.role]);

  const applyOrdersToConversationVisibility = useCallback(
    (orders) => {
      ordersRef.current = Array.isArray(orders) ? orders : [];
      setTailorChatConversations((prev) => {
        if (!prev.length) return prev;
        const filtered = filterConversationsByOrders(prev, ordersRef.current);
        if (filtered.length === prev.length) return prev;
        return sortTailorConversationsDesc(filtered);
      });
    },
    [filterConversationsByOrders]
  );

  const value = useMemo(
    () => ({
      activeTailorShopId,
      tailorChatConversations,
      setTailorChatConversations,
      tailorConversationsLoading,
      fetchTailorConversations,
      applyOrdersToConversationVisibility,
    }),
    [
      activeTailorShopId,
      tailorChatConversations,
      tailorConversationsLoading,
      fetchTailorConversations,
      applyOrdersToConversationVisibility,
    ]
  );

  return <TailorChatContext.Provider value={value}>{children}</TailorChatContext.Provider>;
}

export function useTailorChat() {
  const ctx = useContext(TailorChatContext);
  if (ctx) return ctx;
  return {
    activeTailorShopId: "",
    tailorChatConversations: [],
    setTailorChatConversations: () => {},
    tailorConversationsLoading: false,
    fetchTailorConversations: async () => {},
    applyOrdersToConversationVisibility: () => {},
  };
}
