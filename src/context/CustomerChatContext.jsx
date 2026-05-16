import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CustomerChatWindow from "../CustomerChatWindow.jsx";
import { ensureSocketThen, socket } from "../socket.js";
import {
  CHAT_ROOM_CUSTOMER_SYNC_EVENT,
  dedupeConversationsByOrderId,
  getOrderChatConversationId,
  logConversationRowsValidation,
  messageBelongsToOrderChat,
  normalizeChatId,
  normalizeConversationId,
  readChatRoomCustomerIdFromStorage,
} from "../chatUtils.js";
import { resolveCustomerIdForChat } from "../utils/chatIdentity.js";
import {
  inferPeerIdFromMessage,
  resolveConversationPeers,
} from "../utils/orderChatParticipants.js";
import { getApiBaseUrl } from "../api/client.js";
import {
  getLinkedWizardOrderId,
  wizardOrderAcceptMatches,
} from "../utils/measurementWizardOrderSync.js";
import { useAuth } from "./AuthContext.jsx";

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

function isWizardRoute(pathname) {
  return (
    pathname.includes("measurement") ||
    pathname.includes("wizard") ||
    pathname.includes("/map") ||
    pathname.includes("location-step")
  );
}

function resolveCurrentWizardOrderId() {
  return normalizeConversationId(getLinkedWizardOrderId() || "");
}

function resolveAcceptedOrderId(payload) {
  return normalizeConversationId(payload?.orderId ?? payload?.conversationId ?? "");
}

function customerMatchesOrderAcceptedPayload(payload, authCustomerIdForApi, user) {
  const pid = payload?.customerId != null ? String(payload.customerId).trim() : "";
  if (!pid) return true;
  const a = authCustomerIdForApi ? String(authCustomerIdForApi).trim() : "";
  const b = user ? String(resolveCustomerIdForChat(user)).trim() : "";
  return (!a && !b) || pid === a || pid === b;
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
  const [customerChatConversations, setCustomerChatConversations] = useState([]);
  const [modalChatRow, setModalChatRow] = useState(null);
  const customerReconcileRefetchAtRef = useRef(0);

  /** Legacy hook for review pages — sets modal thread from order row only (no global tailor). */
  const syncCustomerOrderChatFromOrder = useCallback(
    (order) => {
      if (!order || !order.tailorId) {
        setModalChatRow(null);
        return;
      }
      const oid = order.id ?? order._id;
      const oidStr = oid != null ? String(oid).trim() : "";
      if (!oidStr) {
        setModalChatRow(null);
        return;
      }
      setModalChatRow({
        orderId: oidStr,
        conversationId: normalizeConversationId(getOrderChatConversationId(oidStr)),
        customerId: normalizeChatId(order.customerId),
        tailorId: normalizeChatId(order.tailorId),
        tailorName: order.tailorName || order.tailorShopName,
        customerName: order.customerName,
        status: order.status,
        isActive: order.isActive,
        acceptedAt: order.acceptedAt,
      });
    },
    []
  );

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

  const authCustomerIdForApi = useMemo(() => {
    if (!user || user.role !== "customer") return "";
    const id = user.id ?? user.customerId ?? user._id;
    return id != null ? String(id).trim() : "";
  }, [user]);

  const customerId = authCustomerIdForApi;

  const modalPeers = useMemo(() => {
    if (!modalChatRow || !authCustomerIdForApi) return null;
    return resolveConversationPeers({
      row: modalChatRow,
      currentUserId: authCustomerIdForApi,
      mode: "customer",
    });
  }, [modalChatRow, authCustomerIdForApi]);

  /** @deprecated Chat routing uses per-conversation rows; always empty for global send. */
  const tailorIdForChat = "";
  const conversationId = "";

  /** Join customer user socket rooms on every page — server emits orderAccepted to these rooms. */
  useEffect(() => {
    if (user?.role !== "customer" || !user) return undefined;
    const joinCustomerRooms = () => {
      const primary = authCustomerIdForApi;
      const alt = resolveCustomerIdForChat(user);
      if (primary) {
        console.log("[chat] joining room", primary);
        socket.emit("join_user", { userId: primary });
      }
      if (alt && alt !== primary) {
        console.log("[chat] joining room", alt);
        socket.emit("join_user", { userId: alt });
      }
    };
    ensureSocketThen(joinCustomerRooms);
    socket.on("connect", joinCustomerRooms);
    return () => {
      socket.off("connect", joinCustomerRooms);
    };
  }, [user, user?.role, authCustomerIdForApi]);

  /**
   * After tailor accepts: on wizard, redirect only when THIS wizard order was accepted;
   * elsewhere keep redirect-to-dashboard behavior for map / track flows.
   */
  useEffect(() => {
    if (user?.role !== "customer") return undefined;
    const onOrderAccepted = (payload = {}) => {
      if (!customerMatchesOrderAcceptedPayload(payload, authCustomerIdForApi, user)) return;

      const onWizard = isWizardRoute(location.pathname);
      const currentWizardOrderId = resolveCurrentWizardOrderId();
      const acceptedOrderId = resolveAcceptedOrderId(payload);

      if (onWizard) {
        console.log("[wizard] current order", currentWizardOrderId || "(none)");
        console.log("[wizard] accepted order", acceptedOrderId || "(none)");
        if (!currentWizardOrderId || !acceptedOrderId) return;
        if (!wizardOrderAcceptMatches(payload, currentWizardOrderId)) return;
        console.log("[Customer] orderAccepted (wizard match) → /customer/dashboard");
        navigate("/customer/dashboard", { replace: true });
        return;
      }

      if (location.pathname === "/customer/dashboard") return;
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
      const base = getApiBaseUrl();
      if (!base) return;
      const res = await fetch(`${base}/conversations/customer/${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        console.warn("[ChatSync customer] Conversation fetch failed: Forbidden", { cid, data });
      }
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
            tailorId: inferPeerIdFromMessage(message, authCustomerIdForApi) || "",
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
      if (authCustomerIdForApi) {
        socket.emit("join_user", { userId: authCustomerIdForApi });
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
              tailorId:
                inferPeerIdFromMessage(payload, authCustomerIdForApi) ||
                normalizeChatId(payload?.tailorId) ||
                "",
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
  }, [authCustomerIdForApi, fetchCustomerConversations, location.pathname, scheduleCustomerConversationsReconcile]);

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname)) return undefined;

    const conv = normalizeConversationId(modalPeers?.conversationId);

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
  }, [location.pathname, modalPeers?.conversationId]);

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
        isOpen={isChatOpen && Boolean(modalPeers?.conversationId)}
        onClose={closeCustomerChat}
        senderId={modalPeers?.senderId}
        receiverId={modalPeers?.receiverId}
        customerId={modalPeers?.customerId}
        tailorId={modalPeers?.tailorId}
        orderId={modalPeers?.orderId}
        isChatEnabled={modalPeers?.isChatEnabled}
        tailorName={modalPeers?.peerDisplayName || "Your tailor"}
        conversationId={modalPeers?.conversationId}
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
