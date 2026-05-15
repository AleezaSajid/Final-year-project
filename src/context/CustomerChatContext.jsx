import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CustomerChatWindow from "../CustomerChatWindow.jsx";
import { ensureSocketThen, socket } from "../socket.js";
import {
  CHAT_IDS_FROM_ORDER_EVENT,
  CHAT_ROOM_CUSTOMER_SYNC_EVENT,
  dedupeConversationsByOrderId,
  getOrderChatConversationId,
  isOrderEligibleForChat,
  logConversationRowsValidation,
  messageBelongsToOrderChat,
  normalizeChatId,
  normalizeConversationId,
  readChatRoomCustomerIdFromStorage,
} from "../chatUtils.js";
import {
  looksLikeTailorShopId,
  resolveCustomerIdForChat,
  resolveTailorIdForCustomerChat,
  TAILOR_SESSION_STORAGE_KEY,
} from "../utils/chatIdentity.js";
import { useAuth } from "./AuthContext.jsx";
import { API_BASE_URL } from "../tailorDashboard/constants.js";

const PREVIEW_SESSION_KEY = "sewserve_customer_chat_last_preview";

function readStoredChatPreview() {
  try {
    const raw = sessionStorage.getItem(PREVIEW_SESSION_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (j && typeof j.text === "string" && j.text.trim()) {
      return { text: j.text, at: typeof j.at === "number" ? j.at : 0 };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function belongsToConversation(message, conversationId) {
  return messageBelongsToOrderChat(message, conversationId);
}

function sortCustomerConversationsDesc(rows) {
  const deduped = dedupeConversationsByOrderId(rows);
  return [...deduped].sort((a, b) => {
    const ta = new Date(a?.lastMessageAt || a?.updatedAt || 0).getTime();
    const tb = new Date(b?.lastMessageAt || b?.updatedAt || 0).getTime();
    return tb - ta;
  });
}

function customerConvRowIndex(list, rawId) {
  const n = normalizeConversationId(rawId);
  if (!n) return -1;
  return list.findIndex((r) => normalizeConversationId(r?.orderId ?? r?.conversationId) === n);
}

const CustomerChatContext = createContext(null);

function isCustomerChatPath(pathname) {
  return pathname === "/customer/dashboard" || pathname.startsWith("/customer/review");
}

export function CustomerChatProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [lastChatPreview, setLastChatPreview] = useState(() => readStoredChatPreview());
  const [orderRoomCustomerId, setOrderRoomCustomerId] = useState(() => readChatRoomCustomerIdFromStorage());
  const [orderLinkedIdsVersion, setOrderLinkedIdsVersion] = useState(0);
  const [orderChatBinding, setOrderChatBinding] = useState(null);
  const [customerChatConversations, setCustomerChatConversations] = useState([]);
  const customerReconcileRefetchAtRef = useRef(0);

  const syncCustomerOrderChatFromOrder = useCallback((order) => {
    if (!order || !isOrderEligibleForChat(order, { allowLegacyPlaceholderTailor: true })) {
      setOrderChatBinding(null);
      return;
    }
    const oid = order.id ?? order._id;
    const oidStr = oid != null ? String(oid).trim() : "";
    if (!oidStr) {
      setOrderChatBinding(null);
      return;
    }
    setOrderChatBinding({
      customerId: normalizeChatId(order.customerId),
      tailorId: normalizeChatId(order.tailorId),
      conversationId: normalizeConversationId(getOrderChatConversationId(oidStr)),
    });
  }, []);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

  useEffect(() => {
    const onRoomSync = (e) => {
      const id = e?.detail?.customerId;
      if (id != null && String(id).trim() !== "") {
        setOrderRoomCustomerId(String(id).trim());
      }
    };
    window.addEventListener(CHAT_ROOM_CUSTOMER_SYNC_EVENT, onRoomSync);
    return () => window.removeEventListener(CHAT_ROOM_CUSTOMER_SYNC_EVENT, onRoomSync);
  }, []);

  useEffect(() => {
    const bump = () => setOrderLinkedIdsVersion((v) => v + 1);
    window.addEventListener(CHAT_IDS_FROM_ORDER_EVENT, bump);
    return () => window.removeEventListener(CHAT_IDS_FROM_ORDER_EVENT, bump);
  }, []);

  const customerId = useMemo(() => {
    if (orderChatBinding?.customerId) return orderChatBinding.customerId;
    const raw = orderRoomCustomerId || resolveCustomerIdForChat(user);
    return normalizeChatId(raw) || "CU-001";
  }, [orderChatBinding, orderRoomCustomerId, user]);

  const tailorIdForChat = useMemo(() => {
    void orderLinkedIdsVersion;
    const fromOrder = orderChatBinding?.tailorId != null ? normalizeChatId(orderChatBinding.tailorId) : "";
    if (fromOrder && looksLikeTailorShopId(fromOrder)) return fromOrder;
    const r = normalizeChatId(resolveTailorIdForCustomerChat(user));
    if (looksLikeTailorShopId(r)) return r;
    if (fromOrder) return fromOrder;
    try {
      const raw = localStorage.getItem(TAILOR_SESSION_STORAGE_KEY);
      const s = raw != null ? String(raw).trim() : "";
      if (s) return normalizeChatId(s);
    } catch {
      /* ignore */
    }
    return "";
  }, [orderChatBinding, user, orderLinkedIdsVersion]);

  const conversationId = useMemo(
    () => normalizeConversationId(orderChatBinding?.conversationId || ""),
    [orderChatBinding]
  );

  useEffect(() => {
    if (conversationId) console.log("[ChatSync customer] active conversationId", conversationId);
  }, [conversationId]);

  const authCustomerIdForApi = useMemo(() => {
    if (!user || user.role !== "customer") return "";
    const id = user.id ?? user.customerId ?? user._id;
    return id != null ? String(id).trim() : "";
  }, [user]);

  /** Join customer user socket rooms on every page — server emits orderAccepted to these rooms. */
  useEffect(() => {
    if (user?.role !== "customer" || !user) return undefined;
    const joinCustomerRooms = () => {
      const primary = authCustomerIdForApi;
      const alt = resolveCustomerIdForChat(user);
      if (primary) socket.emit("join_user", { userId: primary });
      if (alt && alt !== primary) socket.emit("join_user", { userId: alt });
    };
    ensureSocketThen(joinCustomerRooms);
    socket.on("connect", joinCustomerRooms);
    return () => {
      socket.off("connect", joinCustomerRooms);
    };
  }, [user, user?.role, authCustomerIdForApi]);

  /** After tailor accepts, customer goes to dashboard (wizard, map, track-orders, etc.). */
  useEffect(() => {
    if (user?.role !== "customer") return undefined;
    const onOrderAccepted = (payload = {}) => {
      if (location.pathname === "/customer/dashboard") return;
      const pid = payload?.customerId != null ? String(payload.customerId).trim() : "";
      if (pid) {
        const a = authCustomerIdForApi ? String(authCustomerIdForApi).trim() : "";
        const b = user ? String(resolveCustomerIdForChat(user)).trim() : "";
        const match = (!a && !b) || pid === a || pid === b;
        if (!match) return;
      }
      console.log("[Customer] orderAccepted → navigating to /customer/dashboard");
      navigate("/customer/dashboard", { replace: true });
    };
    socket.on("orderAccepted", onOrderAccepted);
    return () => socket.off("orderAccepted", onOrderAccepted);
  }, [user, user?.role, navigate, location.pathname, authCustomerIdForApi]);

  const fetchCustomerConversations = useCallback(async () => {
    const cid = authCustomerIdForApi;
    if (!cid) return;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/customer/${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.conversations) ? data.conversations : [];
      logConversationRowsValidation(list, "customer fetch");
      console.log("[ChatSync customer] fetched conversations", list.length, list);
      setCustomerChatConversations(sortCustomerConversationsDesc(list));
    } catch (e) {
      console.error("[ChatSync customer] fetch conversations failed", e);
    }
  }, [authCustomerIdForApi]);

  const scheduleCustomerConversationsReconcile = useCallback(
    (reason) => {
      const now = Date.now();
      if (now - customerReconcileRefetchAtRef.current < 1600) return;
      customerReconcileRefetchAtRef.current = now;
      console.log("[ChatSync] reconcile refetch customer conversations", reason);
      void fetchCustomerConversations();
    },
    [fetchCustomerConversations]
  );

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname) || user?.role !== "customer") return undefined;
    void fetchCustomerConversations();
    return undefined;
  }, [fetchCustomerConversations, location.pathname, user?.role]);

  const customerSidebarUnread = useMemo(
    () =>
      customerChatConversations.reduce((n, c) => n + Math.max(0, Number(c.unreadCustomer || 0)), 0),
    [customerChatConversations]
  );

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname) || user?.role !== "customer") return;
    if (isChatOpen) return;
    if (customerChatConversations.length === 0) return;
    setUnreadChatCount(Math.min(customerSidebarUnread, 999));
  }, [
    customerChatConversations.length,
    customerSidebarUnread,
    isChatOpen,
    location.pathname,
    user?.role,
  ]);

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname) || user?.role !== "customer") return undefined;

    const onConversationUpdated = (payload) => {
      console.log("[ChatSync] conversation:updated (customer)", payload);
      const nCid = normalizeConversationId(payload?.conversationId);
      if (!nCid) return;
      setCustomerChatConversations((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const i = customerConvRowIndex(list, nCid);
        const base =
          i >= 0
            ? { ...list[i] }
            : {
                orderId: nCid,
                conversationId: nCid,
                customerId: authCustomerIdForApi,
                tailorId: normalizeChatId(payload?.tailorId) || "",
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
        return sortCustomerConversationsDesc(list);
      });
    };

    const onMessageSidebar = (message) => {
      console.log("[ChatSync] message_received (customer conv list)", message);
      const nCid = normalizeConversationId(message?.conversationId);
      if (!nCid) return;
      setCustomerChatConversations((prev) => {
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
            customerId: authCustomerIdForApi,
            tailorId: normalizeChatId(message?.senderId) || "",
            lastMessage: text ? text.slice(0, 400) : "",
            lastMessageAt: message?.timestamp || new Date().toISOString(),
            unreadCustomer: 0,
            unreadTailor: 0,
            status: "active",
          };
          list.unshift(stub);
          scheduleCustomerConversationsReconcile("message_received_missing_row");
          return sortCustomerConversationsDesc(list);
        }
        const row = { ...list[i] };
        const text = String(message?.content ?? "").trim();
        if (text) row.lastMessage = text.slice(0, 400);
        row.lastMessageAt = message?.timestamp || new Date().toISOString();
        list.splice(i, 1);
        list.unshift(row);
        return sortCustomerConversationsDesc(list);
      });
    };

    socket.on("conversation:updated", onConversationUpdated);
    socket.on("message_received", onMessageSidebar);
    return () => {
      socket.off("conversation:updated", onConversationUpdated);
      socket.off("message_received", onMessageSidebar);
    };
  }, [
    authCustomerIdForApi,
    fetchCustomerConversations,
    location.pathname,
    scheduleCustomerConversationsReconcile,
    user?.role,
  ]);

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname)) {
      return undefined;
    }

    const joinRoom = () => {
      if (customerId) {
        socket.emit("join_user", { userId: customerId });
      }
      if (conversationId) {
        const n = normalizeConversationId(conversationId);
        console.log("[ChatSync Socket] joined room (customer dashboard path)", n);
        socket.emit("join_conversation", { conversationId: n });
        socket.emit("request_history", { conversationId: n });
      }
    };
    const handleNewNotification = (payload) => {
      if (payload?.type !== "new_message") return;
      if (normalizeChatId(payload?.senderId) === normalizeChatId(customerId)) return;
      if (isChatOpenRef.current) return;
      const nCid = normalizeConversationId(payload?.conversationId);
      if (nCid) {
        setCustomerChatConversations((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const i = customerConvRowIndex(list, nCid);
          if (i < 0) {
            list.unshift({
              orderId: nCid,
              conversationId: nCid,
              customerId: authCustomerIdForApi,
              tailorId: normalizeChatId(tailorIdForChat) || "",
              lastMessage: String(payload?.content || "").slice(0, 400),
              lastMessageAt: payload?.timestamp || new Date().toISOString(),
              unreadCustomer: 1,
              unreadTailor: 0,
              status: "active",
            });
            scheduleCustomerConversationsReconcile("new_notification_missing_row");
            return sortCustomerConversationsDesc(list);
          }
          const row = { ...list[i] };
          row.lastMessage = String(payload?.content || "").slice(0, 400);
          row.lastMessageAt = payload?.timestamp || new Date().toISOString();
          list.splice(i, 1);
          list.unshift(row);
          return sortCustomerConversationsDesc(list);
        });
      }
      scheduleCustomerConversationsReconcile("new_notification");
    };

    socket.on("connect", joinRoom);
    socket.on("new_notification", handleNewNotification);
    if (!socket.connected) {
      socket.connect();
    } else {
      joinRoom();
    }

    return () => {
      socket.off("connect", joinRoom);
      socket.off("new_notification", handleNewNotification);
    };
  }, [
    authCustomerIdForApi,
    customerId,
    conversationId,
    fetchCustomerConversations,
    location.pathname,
    scheduleCustomerConversationsReconcile,
    tailorIdForChat,
  ]);

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname)) return undefined;

    const conv = normalizeConversationId(conversationId);

    const persistPreview = (text, at) => {
      const next = { text: String(text).trim().slice(0, 200), at: at || Date.now() };
      if (!next.text) return;
      setLastChatPreview(next);
      try {
        sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    };

    const handleMessageReceived = (message) => {
      if (!conv || !messageBelongsToOrderChat(message, conv)) return;
      const text = String(message?.content ?? "").trim();
      if (!text) return;
      persistPreview(text, message.timestamp || Date.now());
    };

    const handleChatHistory = (payload) => {
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      const list = conv ? history.filter((m) => belongsToConversation(m, conv)) : [];
      const last = list[list.length - 1];
      if (last && String(last.content || "").trim()) {
        persistPreview(String(last.content).trim(), last.timestamp || Date.now());
      }
    };

    socket.on("message_received", handleMessageReceived);
    socket.on("chat_history", handleChatHistory);
    return () => {
      socket.off("message_received", handleMessageReceived);
      socket.off("chat_history", handleChatHistory);
    };
  }, [location.pathname, conversationId]);

  const openCustomerChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeCustomerChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isChatOpen,
      openCustomerChat,
      closeCustomerChat,
      syncCustomerOrderChatFromOrder,
      customerId,
      conversationId,
      tailorIdForChat,
      unreadChatCount,
      lastChatPreview,
      customerChatConversations,
      fetchCustomerConversations,
    }),
    [
      isChatOpen,
      openCustomerChat,
      closeCustomerChat,
      syncCustomerOrderChatFromOrder,
      customerId,
      conversationId,
      tailorIdForChat,
      unreadChatCount,
      lastChatPreview,
      customerChatConversations,
      fetchCustomerConversations,
    ]
  );

  return (
    <CustomerChatContext.Provider value={value}>
      {children}
      <CustomerChatWindow
        isOpen={isChatOpen}
        onClose={closeCustomerChat}
        customerId={customerId}
        tailorId={String(tailorIdForChat)}
        tailorName="Your tailor"
        conversationId={conversationId}
      />
    </CustomerChatContext.Provider>
  );
}

export function useCustomerChat() {
  const ctx = useContext(CustomerChatContext);
  if (ctx) return ctx;
  return {
    isChatOpen: false,
    openCustomerChat: () => {},
    closeCustomerChat: () => {},
    syncCustomerOrderChatFromOrder: () => {},
    customerId: "CU-001",
    conversationId: "",
    tailorIdForChat: "",
    unreadChatCount: 0,
    lastChatPreview: null,
    customerChatConversations: [],
    fetchCustomerConversations: async () => {},
  };
}
