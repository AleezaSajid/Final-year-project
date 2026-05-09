import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import CustomerChatWindow from "../CustomerChatWindow.jsx";
import { socket } from "../socket.js";
import {
  CHAT_IDS_FROM_ORDER_EVENT,
  CHAT_ROOM_CUSTOMER_SYNC_EVENT,
  getOrderChatConversationId,
  isOrderEligibleForChat,
  normalizeChatId,
  readChatRoomCustomerIdFromStorage,
} from "../chatUtils.js";
import { resolveCustomerIdForChat, resolveTailorIdForCustomerChat } from "../utils/chatIdentity.js";
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
  return normalizeChatId(message?.conversationId) === normalizeChatId(conversationId);
}

const CustomerChatContext = createContext(null);

function isCustomerChatPath(pathname) {
  return pathname === "/customer/dashboard" || pathname.startsWith("/customer/review");
}

export function CustomerChatProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [lastChatPreview, setLastChatPreview] = useState(() => readStoredChatPreview());
  const [orderRoomCustomerId, setOrderRoomCustomerId] = useState(() => readChatRoomCustomerIdFromStorage());
  const [orderLinkedIdsVersion, setOrderLinkedIdsVersion] = useState(0);
  const [orderChatBinding, setOrderChatBinding] = useState(null);

  const syncCustomerOrderChatFromOrder = useCallback((order) => {
    if (!order || !isOrderEligibleForChat(order)) {
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
      conversationId: getOrderChatConversationId(oidStr),
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
    if (orderChatBinding?.tailorId) return orderChatBinding.tailorId;
    return normalizeChatId(resolveTailorIdForCustomerChat(user)) || "T-A1";
  }, [orderChatBinding, user, orderLinkedIdsVersion]);

  const conversationId = useMemo(
    () => normalizeChatId(orderChatBinding?.conversationId || ""),
    [orderChatBinding]
  );

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname)) {
      return undefined;
    }

    const joinRoom = () => {
      if (customerId) {
        socket.emit("join_user", { userId: customerId });
      }
      if (conversationId) {
        socket.emit("join_conversation", { conversationId });
        socket.emit("request_history", { conversationId });
      }
    };
    const handleNewNotification = (payload) => {
      if (payload?.type !== "new_message") return;
      if (normalizeChatId(payload?.senderId) === normalizeChatId(customerId)) return;
      if (conversationId && normalizeChatId(payload?.conversationId) !== normalizeChatId(conversationId)) return;
      if (isChatOpenRef.current) return;
      setUnreadChatCount((c) => Math.min(c + 1, 999));
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
  }, [customerId, conversationId, location.pathname]);

  useEffect(() => {
    if (!isCustomerChatPath(location.pathname)) return undefined;

    const conv = normalizeChatId(conversationId);

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
      if (!conv || normalizeChatId(message?.conversationId) !== conv) return;
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
    tailorIdForChat: "T-A1",
    unreadChatCount: 0,
    lastChatPreview: null,
  };
}
