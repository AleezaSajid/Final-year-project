import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { patchOrderWizardFields } from "../../api/ordersApi.js";
import { getUserRole } from "../../utils/userRole.js";
import { canUpdateWorkflowStatus, resolveWorkflowControlRole } from "../../utils/workflowRole.js";
import { buildViewModelFromFullWizardData } from "../../utils/wizardDataToReviewViewModel.js";
import { ensureSocketThen, socket } from "../../socket";
import {
  dedupeConversationsByOrderId,
  getOrderChatConversationId,
  isOrderEligibleForChat,
  isOrderHiddenFromTailorChatList,
  isOrderRejected,
  logConversationRowsValidation,
  messageBelongsToOrderChat,
  normalizeChatId,
  normalizeConversationId,
} from "../../chatUtils";
import {
  clearConversationJoinRegistry,
  isConversationRoomJoined,
  notifyConversationRoomJoined,
} from "../../conversationJoinRegistry.js";
import {
  isPlaceholderTailorShopId,
  looksLikeTailorShopId,
  resolveLoggedInTailorShopId,
  syncTailorSessionFromTailorUser,
} from "../../utils/chatIdentity.js";
import {
  DEFAULT_CUSTOMER_ID,
  defaultProfiles,
  GARMENT_REGEX,
  isPendingWorkflowStatus,
  normalizeOrder,
  normalizeStatus,
  resolveOrderWorkflowState,
  TAILOR_CURRENT_TASKS_VISIBLE_MAX,
  workflowStages,
} from "../constants";
import { getTailorProfileSelf, patchTailorProfileSelf } from "../../api/accountApi.js";
import { getApiBaseUrl } from "../../api/client.js";
import {
  getPriorityScore,
  getTrackingStatus,
  getWorkflowIndex,
  getTailorOrderScheduleDate,
  isTailorCurrentTaskOrder,
  isTailorMeasurementReviewOrder,
} from "../../utils/workflowEngine.js";

function isPlainOrderObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge nested blobs so socket/API partials do not wipe richer local rows. */
function mergeOrderPatch(existing, patch) {
  if (!isPlainOrderObject(patch)) return existing;
  const base = isPlainOrderObject(existing) ? existing : {};
  const out = { ...base, ...patch };
  for (const key of ["notes", "orderPayload", "wizardData", "measurements", "style"]) {
    const p = patch[key];
    const e = base[key];
    if (isPlainOrderObject(p) && isPlainOrderObject(e)) {
      out[key] = { ...e, ...p };
    } else if (p !== undefined) {
      out[key] = p;
    }
  }
  return out;
}

function rawOrderMongoId(raw) {
  if (!raw || typeof raw !== "object") return "";
  if (raw.id != null && String(raw.id).trim() !== "") return String(raw.id).trim();
  const oid = raw._id;
  if (oid != null && typeof oid === "object" && "$oid" in oid && oid.$oid != null) {
    return String(oid.$oid).trim();
  }
  if (oid != null) {
    const s = String(oid);
    if (s && s !== "[object Object]") return s.trim();
  }
  return "";
}

function upsertOrdersMerged(prev, raw, tailorIdFilter) {
  if (!raw || typeof raw !== "object") return prev;
  const tid = raw.tailorId != null ? String(raw.tailorId).trim() : "";
  if (tid && String(tailorIdFilter).trim() !== tid) return prev;
  const id = rawOrderMongoId(raw);
  if (!id) return prev;
  const i = prev.findIndex((o) => String(o.id ?? o._id) === id);
  if (i === -1) {
    return [toStoreOrder(raw), ...prev];
  }
  const mergedRaw = mergeOrderPatch(prev[i], raw);
  const next = [...prev];
  next[i] = toStoreOrder(mergedRaw);
  return next;
}

function toStoreOrder(raw) {
  return normalizeOrder(raw);
}

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

export function useTailorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeTailorShopId = useMemo(() => resolveLoggedInTailorShopId(user), [user]);

  const [profiles, setProfiles] = useState(() => ({ ...defaultProfiles }));

  const [orders, setOrders] = useState(() => []);

  useEffect(() => {
    syncTailorSessionFromTailorUser(user);
  }, [user]);

  const [activeOrderId, _setActiveOrderId] = useState("");

  const setActiveOrderId = useCallback((id) => {
    const next = id != null ? String(id) : "";
    _setActiveOrderId(next);
    const raw = next.trim();
    if (!raw) return;
    ensureSocketThen(() => {
      socket.emit("join_order_room", raw);
      socket.emit("order:selected", { orderId: raw });
    });
  }, []);
  const [newOrder, setNewOrder] = useState({
    customerName: "",
    garmentType: "",
    dueDate: "",
    price: "",
    orderImages: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [profileForm, setProfileForm] = useState({ name: "", skills: "", experience: "" });
  const [displayStats, setDisplayStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 });
  const [displayMonthlyRevenue, setDisplayMonthlyRevenue] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [activeChatCustomer, setActiveChatCustomer] = useState({ id: "", name: "Customer" });
  const [activeConversationId, setActiveConversationId] = useState("");
  /** From GET /conversations/tailor/:id â€” source for dashboard chat list + unread. */
  const [tailorChatConversations, setTailorChatConversations] = useState([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  /** Latest `wizardData` from `measurement:reviewed` (includes normalized `image`). */
  const [reviewCardData, setReviewCardData] = useState(null);
  /** Dedupe when server emits to both tailor room + order room (same socket may be in both). */
  const measurementReviewDedupeRef = useRef("");
  const tailorReconcileRefetchAtRef = useRef(0);

  useEffect(() => {
    setOrders([]);
    _setActiveOrderId("");
    setReviewModalOpen(false);
    setReviewModalOrder(null);
    setReviewCardData(null);
  }, [activeTailorShopId]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

  const fetchOrders = useCallback(async () => {
    const base = getApiBaseUrl();
    const tid = String(activeTailorShopId || "").trim();
    if (!base || !tid) return null;
    try {
      const url = `${base}/orders?tailorId=${encodeURIComponent(tid)}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[TailorDashboard] fetchOrders failed", res.status, data);
        if (res.status === 403) {
          setNotifications((prev) => ["Order fetch failed: Forbidden", ...prev]);
        }
        return null;
      }
      if (!Array.isArray(data)) return null;
      const normalizedData = data.map(toStoreOrder);

      setOrders(() => normalizedData);
      return normalizedData;
    } catch (err) {
      console.error("Error fetching orders", err);
      return null;
    }
  }, [activeTailorShopId]);

  const fetchTailorConversations = useCallback(async () => {
    const tid = String(activeTailorShopId || "").trim();
    if (!tid || user?.role !== "tailor") return;
    const base = getApiBaseUrl();
    if (!base) return;
    try {
      const res = await fetch(`${base}/conversations/tailor/${encodeURIComponent(tid)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        console.warn("[ChatSync tailor] Conversation fetch failed: Forbidden", { tid, data });
        setNotifications((prev) => ["Conversation fetch failed: Forbidden", ...prev]);
      }
      const list = Array.isArray(data?.conversations) ? data.conversations : [];
      logConversationRowsValidation(list, "tailor fetch");
      const visible = list.filter((row) => {
        const oid = normalizeConversationId(row?.orderId ?? row?.conversationId);
        if (!oid) return false;
        const order = orders.find((o) => {
          const a = String(o?.id ?? o?._id ?? "").trim();
          return a === oid;
        });
        return !isOrderHiddenFromTailorChatList(order, row);
      });
      setTailorChatConversations(sortTailorConversationsDesc(visible));
    } catch (e) {
      console.error("[ChatSync tailor] fetch conversations failed", e);
    }
  }, [activeTailorShopId, user?.role, orders]);

  const scheduleTailorConversationsReconcile = useCallback(
    (reason) => {
      const now = Date.now();
      if (now - tailorReconcileRefetchAtRef.current < 1600) return;
      tailorReconcileRefetchAtRef.current = now;
      void fetchTailorConversations();
    },
    [fetchTailorConversations]
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    void fetchTailorConversations();
  }, [fetchTailorConversations]);

  const tailorSidebarUnread = useMemo(
    () =>
      tailorChatConversations.reduce((n, c) => n + Math.max(0, Number(c.unreadTailor || 0)), 0),
    [tailorChatConversations]
  );

  useEffect(() => {
    if (user?.role !== "tailor") return;
    const convOpen = Boolean(String(activeConversationId || "").trim());
    if (isChatOpen || convOpen) {
      setUnreadChatCount(0);
      return;
    }
    setUnreadChatCount(Math.min(tailorSidebarUnread, 999));
  }, [tailorSidebarUnread, isChatOpen, activeConversationId, user?.role]);

  useEffect(() => {
    // Remove legacy "New order from ..." noise from existing in-memory notifications.
    setNotifications((prev) =>
      prev.filter((note) => !String(note ?? "").toLowerCase().startsWith("new order from "))
    );
  }, []);

  useEffect(() => {
    if (!user?.id || user.role !== "tailor") return;
    let cancelled = false;
    void (async () => {
      const data = await getTailorProfileSelf(user);
      if (cancelled || !data?.profile) return;
      const p = data.profile;
      const shopId = activeTailorShopId;
      if (!shopId) return;
      setProfiles((prev) => ({
        ...prev,
        [shopId]: {
          ...(prev[shopId] || {}),
          name: p.name || prev[shopId]?.name || "",
          skills: p.skills || prev[shopId]?.skills || "",
          experience:
            p.experience !== "" && p.experience != null
              ? `${p.experience} years`
              : prev[shopId]?.experience || "",
        },
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, activeTailorShopId]);

  useEffect(() => {
    socket.connect();

    const joinRoom = () => {
      const room = String(activeTailorShopId || "").trim();
      if (!room) return;
      socket.emit("join_user", { userId: room });
    };
    const handleNewNotification = (payload) => {
      if (payload?.type !== "new_message") return;
      if (normalizeChatId(payload?.senderId) === normalizeChatId(activeTailorShopId)) return;
      setNotifications((prev) => [
        ...prev,
        `New message from ${payload?.senderId || "Customer"}: ${payload?.content || ""}`,
      ]);
      const nCid = normalizeConversationId(payload?.conversationId);
      if (nCid) {
        setTailorChatConversations((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const i = tailorConvRowIndex(list, nCid);
          if (i < 0) {
            const stub = {
              orderId: nCid,
              conversationId: nCid,
              tailorId: String(activeTailorShopId || "").trim(),
              customerId: normalizeChatId(payload?.senderId) || "",
              lastMessage: String(payload?.content || "").slice(0, 400),
              lastMessageAt: payload?.timestamp || new Date().toISOString(),
              unreadTailor: Math.max(0, Number(payload?.unreadTailor ?? 1)),
              unreadCustomer: Math.max(0, Number(payload?.unreadCustomer ?? 0)),
              status: "active",
            };
            list.unshift(stub);
            scheduleTailorConversationsReconcile("new_notification_missing_row");
            return sortTailorConversationsDesc(list);
          }
          const row = { ...list[i] };
          row.lastMessage = String(payload?.content || "").slice(0, 400);
          row.lastMessageAt = payload?.timestamp || new Date().toISOString();
          list.splice(i, 1);
          list.unshift(row);
          return sortTailorConversationsDesc(list);
        });
      }
    };

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
                tailorId: normalizeChatId(payload?.tailorId) || String(activeTailorShopId || "").trim(),
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

    const onMessageReceivedSidebar = (message) => {
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
          scheduleTailorConversationsReconcile("message_received_missing_row");
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

    const onMeasurementUpdated = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      setOrders((prev) => upsertOrdersMerged(prev, raw, activeTailorShopId));
    };

    const onOrderNew = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      setOrders((prev) => upsertOrdersMerged(prev, raw, activeTailorShopId));
    };

    const onOrderStatusUpdatedRelay = (data) => {
      if (!data) return;
      const raw = data.fullOrder;
      if (raw && typeof raw === "object") {
        setOrders((prev) => upsertOrdersMerged(prev, raw, activeTailorShopId));
        return;
      }
      if (data.orderId == null) return;
      const oid = String(data.orderId);
      const st = data.status != null ? String(data.status) : "";
      if (!st) return;
      setOrders((prev) => prev.map((order) => {
        const id = String(order.id ?? order._id ?? "");
        if (id !== oid) return order;
        return toStoreOrder(mergeOrderPatch(order, { status: st }));
      }));
    };

    const onMeasurementReviewed = (data) => {

      if (!data || typeof data !== "object") return;

      const oidRaw =
        data.orderId != null && String(data.orderId).trim() !== ""
          ? String(data.orderId).trim()
          : data.fullOrder?.id != null
            ? String(data.fullOrder.id).trim()
            : data.fullOrder?._id != null
              ? String(data.fullOrder._id).trim()
              : "";
      if (!oidRaw) {
        console.warn("[Tailor Sync] measurement:reviewed ignored â€” no orderId", data);
        return;
      }

      const dedupeKey = `${oidRaw}:${data.timestamp ?? ""}`;
      if (measurementReviewDedupeRef.current === dedupeKey) {
        return;
      }
      measurementReviewDedupeRef.current = dedupeKey;

      const wd = data.wizardData;
      if (!wd || typeof wd !== "object" || Array.isArray(wd)) {
        console.warn("[Tailor Sync] measurement:reviewed ignored â€” bad wizardData");
        return;
      }

      if (data?.wizardData) {
        setReviewCardData(data.wizardData);
      }

      const id = String(oidRaw);

      if (data?.wizardImageDeferred) {
        void (async () => {
          const list = await fetchOrders();
          if (!list) return;
          const raw = list.find((o) => String(o.id ?? o._id) === id);
          if (!raw) return;
          const refreshed = toStoreOrder(raw);
          setReviewModalOrder(refreshed);
          const fullWd = refreshed.wizardData || refreshed.orderPayload;
          if (fullWd && typeof fullWd === "object" && !Array.isArray(fullWd)) {
            setReviewCardData(fullWd);
          }
        })();
      }
      setOrders((prev) => {
        const i = prev.findIndex((o) => String(o.id ?? o._id) === id);
        const prevRow = i >= 0 ? prev[i] : {};
        const view = buildViewModelFromFullWizardData(wd, {
          ...prevRow,
          id,
          _id: id,
          customerId: prevRow.customerId,
          clientOrderId: prevRow.clientOrderId,
          createdAt: prevRow.createdAt,
        });
        const tail = data.tailorId != null ? String(data.tailorId) : activeTailorShopId;
        const patch = {
          id,
          _id: id,
          wizardData: wd,
          orderPayload: wd,
          customerName: view.customerName,
          customerPhone: view.customerPhone,
          garmentType: view.garmentType,
          garmentCategory: view.garmentCategory,
          measurements: view.measurements,
          style: {
            fitType: view.style.fitType,
            fabricType: view.style.fabricType,
            stylePreference: view.style.stylePreference,
            neckStyle: view.style.neckStyle,
          },
          notes: {
            deliveryDate: view.notes.deliveryDate,
            occasion: view.notes.occasion,
            urgency: view.notes.urgency,
            specialInstructions: view.notes.specialInstructions,
            designNote: view.notes.designNote,
          },
          tailorId: tail,
        };
        const merged = mergeOrderPatch(prevRow, patch);
        const row = toStoreOrder(
          i === -1
            ? merged
            : {
                ...merged,
                dueDate: prevRow.dueDate ?? merged.dueDate,
                date: prevRow.date ?? merged.date,
                createdAt: prevRow.createdAt ?? merged.createdAt,
              }
        );
        if (row.tailorId && String(row.tailorId) !== String(activeTailorShopId)) {
          return prev;
        }
        queueMicrotask(() => {
          setReviewModalOrder(row);
          setReviewModalOpen(true);
        });
        if (i === -1) {
          return [...prev, row];
        }
        const next = [...prev];
        next[i] = row;
        return next;
      });
    };

    socket.on("connect", joinRoom);
    if (socket.connected) joinRoom();
    socket.on("new_notification", handleNewNotification);
    socket.on("conversation:updated", onConversationUpdated);
    socket.on("message_received", onMessageReceivedSidebar);
    socket.on("measurement:updated", onMeasurementUpdated);
    socket.on("measurement:reviewed", onMeasurementReviewed);
    socket.on("order:new", onOrderNew);
    socket.on("order:statusUpdated", onOrderStatusUpdatedRelay);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("new_notification", handleNewNotification);
      socket.off("conversation:updated", onConversationUpdated);
      socket.off("message_received", onMessageReceivedSidebar);
      socket.off("measurement:updated", onMeasurementUpdated);
      socket.off("measurement:reviewed", onMeasurementReviewed);
      socket.off("order:new", onOrderNew);
      socket.off("order:statusUpdated", onOrderStatusUpdatedRelay);
    };
  }, [fetchOrders, fetchTailorConversations, scheduleTailorConversationsReconcile, activeTailorShopId]);

  const tailorOrders = useMemo(
    () => orders.filter((order) => String(order.tailorId ?? "").trim() === String(activeTailorShopId).trim()),
    [orders, activeTailorShopId]
  );

  const currentTaskOrders = useMemo(
    () => tailorOrders.filter((order) => isTailorCurrentTaskOrder(order)),
    [tailorOrders]
  );

  useEffect(() => {
    if (!activeTailorShopId) return;
    const shopId = String(activeTailorShopId).trim();
    const joinUserRoom = () => {
      ensureSocketThen(() => {
        socket.emit("join_user", { userId: shopId });
      });
    };
    joinUserRoom();
    const onConnect = () => joinUserRoom();
    socket.on("connect", onConnect);
    return () => socket.off("connect", onConnect);
  }, [activeTailorShopId]);

  useEffect(() => {
    const activeId = normalizeConversationId(activeConversationId);
    if (!activeTailorShopId || !activeId) return;
    const joinActive = (isReconnect) => {
      if (isReconnect) {
        clearConversationJoinRegistry();
      }
      if (!isReconnect && isConversationRoomJoined(activeId)) return;
      ensureSocketThen(() => {
        console.log("[ChatSync] tailor dashboard join_conversation", { conversationId: activeId });
        socket.emit("join_conversation", { conversationId: activeId });
      });
    };
    const onJoined = (payload) => {
      const canonical = normalizeConversationId(payload?.conversationId);
      const requested = normalizeConversationId(payload?.requestedId);
      if (canonical === activeId || requested === activeId) {
        notifyConversationRoomJoined(canonical || activeId);
        console.log("[ChatSync] tailor dashboard conversation:joined", payload);
      }
    };
    joinActive(false);
    socket.on("conversation:joined", onJoined);
    const onReconnect = () => joinActive(true);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("conversation:joined", onJoined);
      socket.io.off("reconnect", onReconnect);
    };
  }, [activeTailorShopId, activeConversationId]);

  const activeOrder = useMemo(() => {
    if (currentTaskOrders.length === 0) return null;
    const aid = String(activeOrderId ?? "").trim();
    if (!aid) return currentTaskOrders[0];
    return (
      currentTaskOrders.find(
        (order) => String(order.id ?? order._id ?? "").trim() === aid
      ) || currentTaskOrders[0]
    );
  }, [currentTaskOrders, activeOrderId]);

  useEffect(() => {
    if (!activeOrder && currentTaskOrders.length > 0) {
      setActiveOrderId(currentTaskOrders[0].id);
    }
  }, [activeOrder, currentTaskOrders, setActiveOrderId]);

  useEffect(() => {
    const current = profiles[activeTailorShopId] || {};
    setProfileForm({
      name: current.name || "",
      skills: current.skills || "",
      experience: String(current.experience || "").replace(" years", ""),
    });
  }, [profiles, activeTailorShopId]);

  const stats = useMemo(() => {
    const total = tailorOrders.length;
    const pending = tailorOrders.filter((o) => isTailorMeasurementReviewOrder(o)).length;
    const inProgress = tailorOrders.filter((o) => isTailorCurrentTaskOrder(o)).length;
    const completed = tailorOrders.filter((o) => resolveOrderWorkflowState(o).internalStatus === "completed").length;
    return { total, pending, inProgress, completed };
  }, [tailorOrders]);

  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return tailorOrders
      .filter((order) => resolveOrderWorkflowState(order).internalStatus === "completed")
      .filter((order) => {
        const d = new Date(order.date || order.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, order) => sum + Number(order.price || 0), 0);
  }, [tailorOrders]);

  useEffect(() => {
    const steps = 20;
    let currentStep = 0;
    const statTimer = setInterval(() => {
      currentStep += 1;
      const progress = currentStep / steps;
      setDisplayStats({
        total: Math.round(stats.total * progress),
        pending: Math.round(stats.pending * progress),
        inProgress: Math.round(stats.inProgress * progress),
        completed: Math.round(stats.completed * progress),
      });
      if (currentStep >= steps) clearInterval(statTimer);
    }, 20);
    return () => clearInterval(statTimer);
  }, [stats]);

  useEffect(() => {
    const steps = 20;
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep += 1;
      const progress = currentStep / steps;
      setDisplayMonthlyRevenue(Math.round(monthlyRevenue * progress));
      if (currentStep >= steps) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [monthlyRevenue]);

  const upcomingOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          String(order.tailorId ?? "").trim() === String(activeTailorShopId).trim() &&
          !isOrderRejected(order) &&
          resolveOrderWorkflowState(order).internalStatus !== "completed"
      ),
    [orders, activeTailorShopId]
  );

  const newOrders = useMemo(() => {
    const nowMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return tailorOrders
      .filter((order) => isTailorMeasurementReviewOrder(order))
      .filter((order) => {
        const orderTime = new Date(order.createdAt || order.date).getTime();
        return Number.isFinite(orderTime) && nowMs - orderTime <= oneDayMs;
      })
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [tailorOrders]);

  const orderMatchesId = useCallback((order, orderId) => {
    const target = String(orderId ?? "").trim();
    if (!target) return false;
    const a = String(order?.id ?? "").trim();
    const b = String(order?._id ?? "").trim();
    return a === target || b === target;
  }, []);

  const updateOrderStatus = async (orderId, newStatus) => {
    const fromAuth = resolveWorkflowControlRole(user);
    const fromStorage = getUserRole();
    const canMutate =
      canUpdateWorkflowStatus(fromAuth) || canUpdateWorkflowStatus(fromStorage);
    if (!canMutate) {
      setNotifications((prev) => [
        "You can't update workflow from this account. Sign in as a tailor.",
        ...prev,
      ]);
      return;
    }

    const normalizedStatus = normalizeStatus(newStatus);
    const resolvedPatch = resolveOrderWorkflowState({
      status: normalizedStatus,
      currentStepIndex: getWorkflowIndex(normalizedStatus),
    });
    const stepIndex = resolvedPatch.workflowIndex;
    const trackingStatus = getTrackingStatus(normalizedStatus);

    setOrders((prev) =>
      prev.map((o) =>
        orderMatchesId(o, orderId)
          ? toStoreOrder(
              mergeOrderPatch(o, {
                status: normalizedStatus,
                workflowStatus: normalizedStatus,
                currentStepIndex: stepIndex,
                currentStep: stepIndex,
              })
            )
          : o
      )
    );

    try {
      const updated = await patchOrderWizardFields(
        String(orderId),
        {
          status: normalizedStatus,
          workflowStatus: normalizedStatus,
          currentStep: stepIndex,
          currentStepIndex: stepIndex,
        },
        { operation: "Order update" }
      );
      const oid = String(updated._id ?? updated.id ?? orderId);
      setOrders((prev) => {
        const existing = prev.find((o) => orderMatchesId(o, orderId)) || { id: oid };
        const merged = toStoreOrder(
          mergeOrderPatch(existing, {
            ...(updated && typeof updated === "object" ? updated : {}),
            status: normalizedStatus,
            workflowStatus: normalizedStatus,
            currentStepIndex: stepIndex,
            currentStep: stepIndex,
          })
        );
        return prev.map((o) => (orderMatchesId(o, orderId) ? merged : o));
      });
      ensureSocketThen(() => {
        socket.emit("join_order_room", oid);
        socket.emit("order:statusUpdated", {
          orderId: oid,
          status: trackingStatus,
          currentStepIndex: stepIndex,
        });
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
      }
      await fetchOrders();
    } catch {
      await fetchOrders();
      setNotifications((prev) => ["Could not sync status with server.", ...prev]);
    }
  };

  /**
   * Accept an incoming order request and immediately move it into Current Tasks.
   * Logic only (no UI changes): assigns `tailorId` to this tailor and keeps workflow consistent.
   */
  const acceptOrderIntoCurrentTasks = useCallback(
    async (orderId, popupHint = null) => {
      const oid = String(orderId || "").trim();
      if (!oid) return false;
      const tailorId = String(activeTailorShopId || "").trim();
      if (!tailorId) {
        setNotifications((prev) => ["Sign in as a tailor with a valid shop id to accept orders.", ...prev]);
        return false;
      }

      const acceptedAtIso = new Date().toISOString();
      const acceptPatch = {
        tailorId,
        status: "accepted",
        workflowStatus: "order_placed",
        currentStepIndex: 0,
        currentStep: 0,
        isActive: true,
        chatEnabled: true,
        acceptedAt: acceptedAtIso,
      };

      const orderMatchesId = (o) => {
        const a = String(o.id ?? o._id ?? "").trim();
        const b = String(o._id ?? o.id ?? "").trim();
        return a === oid || b === oid;
      };

      // Optimistic: mark accepted so chat unlocks immediately.
      setOrders((prev) => {
        const exists = prev.some(orderMatchesId);
        if (exists) {
          return prev.map((o) => (orderMatchesId(o) ? toStoreOrder(mergeOrderPatch(o, acceptPatch)) : o));
        }
        const hinted =
          popupHint && typeof popupHint === "object"
            ? {
                id: oid,
                _id: oid,
                tailorId,
                customerId: popupHint.customerId || "",
                customerName: popupHint.customerName || "",
                garmentType: popupHint.dressType || popupHint.garmentType || "",
                notes: popupHint.notes || "",
                ...acceptPatch,
                createdAt: new Date().toISOString(),
              }
            : { id: oid, _id: oid, tailorId, ...acceptPatch, createdAt: new Date().toISOString() };
        return [toStoreOrder(hinted), ...prev];
      });

      const existingRow =
        orders.find((o) => String(o.id ?? o._id ?? "") === oid || String(o._id ?? "") === oid) ||
        popupHint;
      const existingTid =
        existingRow?.tailorId != null ? String(existingRow.tailorId).trim() : "";
      const isRealAssignedTailor =
        existingTid &&
        looksLikeTailorShopId(existingTid) &&
        !isPlaceholderTailorShopId(existingTid);
      if (isRealAssignedTailor && existingTid !== tailorId) {
        setNotifications((prev) => ["This order belongs to another tailor.", ...prev]);
        await fetchOrders();
        return false;
      }

      try {
        const updated = await patchOrderWizardFields(
          oid,
          {
            action: "accept_order",
            tailorId,
            isActive: true,
            status: "accepted",
            chatEnabled: true,
            acceptedAt: acceptedAtIso,
          },
          { operation: "Accept order" }
        );
        const merged = toStoreOrder(
          mergeOrderPatch(existingRow || { id: oid }, {
            ...(updated && typeof updated === "object" ? updated : {}),
            tailorId,
            status: "accepted",
            workflowStatus: updated?.workflowStatus || "order_placed",
            currentStepIndex: 0,
            currentStep: 0,
            isActive: true,
            chatEnabled: true,
            acceptedAt: updated?.acceptedAt || acceptedAtIso,
          })
        );
        setOrders((prev) => {
          const exists = prev.some((o) => String(o.id ?? o._id ?? "") === oid || String(o._id ?? "") === oid);
          if (!exists) return [merged, ...prev];
          return prev.map((o) =>
            String(o.id ?? o._id ?? "") === oid || String(o._id ?? "") === oid ? merged : o
          );
        });
        setActiveOrderId(oid);
        setDisplayStats((prev) => ({
          ...prev,
          inProgress: Math.max(prev.inProgress, 1),
        }));
        setTailorChatConversations((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const nOid = normalizeConversationId(oid);
          const i = list.findIndex(
            (r) => normalizeConversationId(r?.orderId ?? r?.conversationId) === nOid
          );
          const base =
            i >= 0
              ? { ...list[i] }
              : {
                  orderId: nOid,
                  conversationId: nOid,
                  customerId: merged.customerId || "",
                  customerName: merged.customerName || "Customer",
                  tailorId,
                  garmentType: merged.garmentType || "",
                  lastMessage: "",
                  lastMessageAt: new Date().toISOString(),
                  unreadTailor: 0,
                  unreadCustomer: 0,
                };
          const row = {
            ...base,
            status: "accepted",
            isActive: true,
            customerId: base.customerId || merged.customerId || "",
            tailorId: base.tailorId || tailorId,
          };
          if (i >= 0) list.splice(i, 1);
          list.unshift(row);
          return list;
        });
        setActiveConversationId(normalizeConversationId(oid));
        window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
        void fetchTailorConversations();
        return true;
      } catch (e) {
        console.error("ACCEPT ORDER ERROR", e);
        await fetchOrders();
        const msg =
          (e && typeof e === "object" && "message" in e && e.message ? String(e.message) : "") ||
          "Could not accept the order right now.";
        setNotifications((prev) => [msg, ...prev]);
        return false;
      }
    },
    [activeTailorShopId, fetchOrders, fetchTailorConversations, orders, setActiveOrderId]
  );

  const rejectOrderFromPending = useCallback(
    async (orderId, orderHint = null, rejectionReason = "") => {
      const tailorId = String(activeTailorShopId || "").trim();
      const oid = String(orderId ?? "").trim();
      if (!tailorId || !oid) return false;

      const rejectedAtIso = new Date().toISOString();
      const reasonText = String(rejectionReason || "").trim().slice(0, 500);
      const rejectPatch = {
        status: "rejected",
        workflowStatus: "rejected",
        isActive: false,
        chatEnabled: false,
        acceptedAt: null,
        rejectedAt: rejectedAtIso,
        rejectedBy: tailorId,
        rejectionReason: reasonText,
      };

      setOrders((prev) => {
        const exists = prev.some((o) => orderMatchesId(o, oid));
        if (!exists) return prev;
        return prev.map((o) =>
          orderMatchesId(o, oid)
            ? toStoreOrder(mergeOrderPatch(o, rejectPatch))
            : o
        );
      });

      const existingRow =
        orders.find((o) => orderMatchesId(o, oid)) ||
        (orderHint && typeof orderHint === "object" ? orderHint : null);

      try {
        const updated = await patchOrderWizardFields(
          oid,
          {
            action: "reject_order",
            tailorId,
            ...rejectPatch,
          },
          { operation: "Reject order" }
        );
        const merged = toStoreOrder(
          mergeOrderPatch(existingRow || { id: oid }, {
            ...(updated && typeof updated === "object" ? updated : {}),
            ...rejectPatch,
            status: "rejected",
            workflowStatus: "rejected",
          })
        );
        setOrders((prev) => {
          const exists = prev.some((o) => orderMatchesId(o, oid));
          if (!exists) return [merged, ...prev];
          return prev.map((o) => (orderMatchesId(o, oid) ? merged : o));
        });
        if (String(activeOrderId ?? "").trim() === oid) {
          setActiveOrderId(null);
        }
        const nOid = normalizeConversationId(oid);
        setTailorChatConversations((prev) =>
          (Array.isArray(prev) ? prev : []).filter(
            (r) => normalizeConversationId(r?.orderId ?? r?.conversationId) !== nOid
          )
        );
        if (normalizeConversationId(activeConversationId) === nOid) {
          setActiveConversationId("");
          setIsChatOpen(false);
        }
        window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
        void fetchTailorConversations();
        setNotifications((prev) => [
          reasonText ? `Order request declined: ${reasonText}.` : "Order request declined.",
          ...prev,
        ]);
        return true;
      } catch (e) {
        console.error("REJECT ORDER ERROR", e);
        await fetchOrders();
        const msg =
          (e && typeof e === "object" && "message" in e && e.message ? String(e.message) : "") ||
          "Could not reject the order right now.";
        setNotifications((prev) => [msg, ...prev]);
        return false;
      }
    },
    [
      activeTailorShopId,
      activeOrderId,
      activeConversationId,
      fetchOrders,
      fetchTailorConversations,
      orders,
      orderMatchesId,
      setActiveOrderId,
    ]
  );

  const advanceWorkflow = async () => {
    if (!activeOrder) return;
    setIsAdvancing(true);
    const { workflowIndex: currentIndex } = resolveOrderWorkflowState(activeOrder);
    const nextIndex = Math.min(currentIndex + 1, workflowStages.length - 1);
    const nextStatus = workflowStages[nextIndex].status;
    await updateOrderStatus(activeOrder.id, nextStatus);
    if (nextStatus === "last_review") {
      navigate(`/tailor/last-review/${activeOrder.id}`, {
        state: {
          order: {
            ...activeOrder,
            status: "last_review",
          },
        },
      });
    }
    window.setTimeout(() => setIsAdvancing(false), 220);
  };

  const handleWorkflowStageClick = async (order, stageStatus) => {
    if (!order) return;
    await updateOrderStatus(order.id, stageStatus);
    if (stageStatus === "last_review") {
      navigate(`/tailor/last-review/${order.id}`, {
        state: {
          order: {
            ...order,
            status: "last_review",
          },
        },
      });
    }
  };

  const openChatForOrder = (order, options = {}) => {
    if (!order) {
      return;
    }
    const allowLocked = Boolean(options.allowLocked);
    const tid = order.tailorId != null ? String(order.tailorId).trim() : "";
    if (!tid || !looksLikeTailorShopId(tid)) {
      return;
    }
    if (!allowLocked && !isOrderEligibleForChat(order)) {
      return;
    }
    const targetCustomerId = normalizeChatId(order.customerId) || DEFAULT_CUSTOMER_ID;
    const oid = String(order.id ?? order._id ?? "").trim();
    const conversationId = normalizeConversationId(getOrderChatConversationId(oid));

    setActiveChatCustomer({
      id: targetCustomerId,
      name: order.customerName || "Customer",
    });
    setActiveConversationId(conversationId);

    setActiveOrderId(order.id);
  };

  const openChatFromActiveOrder = () => {
    const candidates = [activeOrder, ...tailorOrders].filter(Boolean);
    const eligible = candidates.find((o) => isOrderEligibleForChat(o));
    if (eligible) {
      openChatForOrder(eligible);
      return;
    }
    setNotifications((prev) => [...prev, "Chat opens after an order is accepted and assigned to you."]);
  };

  const handleNewOrderSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!newOrder.customerName.trim()) nextErrors.customerName = "Customer name is required.";
    if (!newOrder.garmentType.trim()) nextErrors.garmentType = "Garment type is required.";
    else if (!GARMENT_REGEX.test(newOrder.garmentType.trim())) nextErrors.garmentType = "Use letters only.";
    const parsedPrice = Number(newOrder.price);
    if (!newOrder.price || !Number.isFinite(parsedPrice) || parsedPrice <= 0) nextErrors.price = "Price must be greater than 0.";
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const base = getApiBaseUrl();
      if (!base) {
        setNotifications((prev) => ["API base URL is not configured.", ...prev]);
        return;
      }
      const response = await fetch(`${base}/orders`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: newOrder.customerName.trim(),
          customerId: `C-${Date.now()}`,
          tailorId: activeTailorShopId,
          garmentType: newOrder.garmentType.trim(),
          measurements: {},
          dueDate: newOrder.dueDate || null,
          price: parsedPrice,
          status: "pending",
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to create order");
      }

      const payload = await response.json();
      const createdOrder = toStoreOrder(payload);
      setActiveOrderId(createdOrder.id);
      void fetchOrders();
      setNotifications((prev) => [`New order added for ${createdOrder.customerName}.`, ...prev]);
      setNewOrder({ customerName: "", garmentType: "", dueDate: "", price: "", orderImages: [] });
      setFormErrors({});
    } catch {
      setNotifications((prev) => ["Order creation failed. Please try again.", ...prev]);
    }
  };

  const handleProfileUpdate = () => {
    const trimmedName = profileForm.name.trim();
    const trimmedSkills = profileForm.skills.trim();
    const parsedExperience = Number(profileForm.experience);
    setProfiles((prev) => ({
      ...prev,
      [activeTailorShopId]: {
        ...(prev[activeTailorShopId] || {}),
        name: trimmedName || prev[activeTailorShopId]?.name || "",
        skills: trimmedSkills || prev[activeTailorShopId]?.skills || "",
        experience:
          Number.isFinite(parsedExperience) && parsedExperience >= 0
            ? `${parsedExperience} years`
            : prev[activeTailorShopId]?.experience || "",
      },
    }));
    if (user?.id && user.role === "tailor") {
      void patchTailorProfileSelf(user, {
        name: trimmedName,
        skills: trimmedSkills,
        experience: Number.isFinite(parsedExperience) ? parsedExperience : "",
      }).catch(() => {});
    }
    setNotifications((prev) => ["Tailor profile updated successfully.", ...prev]);
  };

  const notificationText = (note) => (typeof note === "string" ? note : note?.text || "");

  const welcomeName = useMemo(() => {
    const fromProfile = profiles[activeTailorShopId]?.name;
    const fromUser = user?.fullName;
    const raw = (fromProfile && String(fromProfile).trim()) || (fromUser && String(fromUser).trim()) || "Tailor";
    const first = String(raw).trim().split(/\s+/)[0];
    return first || raw;
  }, [profiles, activeTailorShopId, user]);

  const currentTaskLines = useMemo(() => {
    const lines = [];
    const pend = tailorOrders.filter(
      (o) =>
        !isOrderRejected(o) &&
        isPendingWorkflowStatus(resolveOrderWorkflowState(o).internalStatus)
    );
    if (pend[0]) {
      lines.push(
        `Finish ${pend[0].customerName} ${pend[0].garmentType} â€” Due ${pend[0].dueDate || pend[0].date || "soon"}`
      );
    }
    const any = tailorOrders.find(
      (o) =>
        !isOrderRejected(o) &&
        resolveOrderWorkflowState(o).internalStatus !== "completed" &&
        isTailorCurrentTaskOrder(o)
    );
    if (any && lines.length < 2) {
      lines.push(`Review ${any.customerName} request â€” Awaiting approval`);
    }
    if (lines.length < 2) {
      const fallback = tailorOrders.find(
        (o) => !isOrderRejected(o) && isTailorCurrentTaskOrder(o)
      );
      if (fallback) {
        lines.push(`${fallback.garmentType} for ${fallback.customerName} â€” in workflow`);
      }
    }
    return lines.slice(0, 2);
  }, [tailorOrders]);

  const calendarPreview = useMemo(
    () =>
      [...tailorOrders]
        .filter((o) => !isOrderRejected(o))
        .filter((o) => resolveOrderWorkflowState(o).internalStatus !== "completed")
        .filter((o) => isTailorCurrentTaskOrder(o))
        .filter((o) => getTailorOrderScheduleDate(o))
        .sort((a, b) =>
          String(getTailorOrderScheduleDate(a)).localeCompare(String(getTailorOrderScheduleDate(b)))
        )
        .slice(0, 2),
    [tailorOrders]
  );

  /** Pending approval requests only (excludes rejected and active current tasks). */
  const measurementsCandidates = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    return [...list]
      .filter((o) => isTailorMeasurementReviewOrder(o))
      .sort((a, b) => getPriorityScore(a) - getPriorityScore(b))
      .slice(0, TAILOR_CURRENT_TASKS_VISIBLE_MAX);
  }, [orders]);

  const donutGradient = useMemo(() => {
    const sum = Math.max(1, displayStats.inProgress + displayStats.pending + displayStats.completed);
    const gIn = (displayStats.inProgress / sum) * 360;
    const gPend = (displayStats.pending / sum) * 360;
    const gDone = (displayStats.completed / sum) * 360;
    const c1 = "#22c55e";
    const c2 = "#eab308";
    const c3 = "#3b82f6";
    const endIn = gIn;
    const endPend = gIn + gPend;
    const endDone = gIn + gPend + gDone;
    return `conic-gradient(${c1} 0deg ${endIn}deg, ${c2} ${endIn}deg ${endPend}deg, ${c3} ${endPend}deg ${endDone}deg, rgba(226,232,240,0.45) ${endDone}deg 360deg)`;
  }, [displayStats]);

  const expectedDeliveryLabel = useMemo(() => {
    if (!activeOrder?.dueDate) return "â€”";
    const d = new Date(activeOrder.dueDate);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (!Number.isFinite(diff)) return "â€”";
    return diff >= 0 ? `${diff} Days` : "Overdue";
  }, [activeOrder]);

  const workflowProgressPct = useMemo(() => {
    if (!activeOrder) return 0;
    const { workflowIndex: idx } = resolveOrderWorkflowState(activeOrder);
    return Math.round(((idx + 1) / workflowStages.length) * 100);
  }, [activeOrder]);

  const openMeasurementsReview = useCallback((order) => {
    if (!order) return;
    setActiveOrderId(String(order.id));
    setReviewCardData(null);
    setReviewModalOrder(toStoreOrder(order));
    setReviewModalOpen(true);
  }, [setActiveOrderId]);

  const closeMeasurementsReview = useCallback(() => {
    setReviewModalOpen(false);
    setReviewModalOrder(null);
    setReviewCardData(null);
  }, []);

  const reviewModalDisplayOrder = useMemo(() => {
    if (!reviewModalOrder) return null;
    if (!reviewCardData) return reviewModalOrder;
    return {
      ...reviewModalOrder,
      wizardData: reviewCardData,
      orderPayload: reviewCardData,
    };
  }, [reviewModalOrder, reviewCardData]);

  return {
    navigate,
    activeTailorShopId,
    profiles,
    /** Live list from GET /orders + socket merges (source for Current Tasks). */
    orders,
    setOrders,
    activeOrderId,
    setActiveOrderId,
    newOrder,
    setNewOrder,
    formErrors,
    notifications,
    profileForm,
    setProfileForm,
    displayStats,
    displayMonthlyRevenue,
    isAdvancing,
    isChatOpen,
    setIsChatOpen,
    unreadChatCount,
    activeChatCustomer,
    activeConversationId,
    tailorChatConversations,
    fetchTailorConversations,
    tailorOrders,
    currentTaskOrders,
    activeOrder,
    upcomingOrders,
    newOrders,
    fetchOrders,
    updateOrderStatus,
    acceptOrderIntoCurrentTasks,
    rejectOrderFromPending,
    advanceWorkflow,
    handleWorkflowStageClick,
    openChatForOrder,
    openChatFromActiveOrder,
    handleNewOrderSubmit,
    handleProfileUpdate,
    notificationText,
    welcomeName,
    currentTaskLines,
    calendarPreview,
    measurementsCandidates,
    donutGradient,
    expectedDeliveryLabel,
    workflowProgressPct,
    reviewModalOpen,
    setReviewModalOpen,
    reviewModalOrder,
    reviewModalDisplayOrder,
    openMeasurementsReview,
    closeMeasurementsReview,
  };
}
