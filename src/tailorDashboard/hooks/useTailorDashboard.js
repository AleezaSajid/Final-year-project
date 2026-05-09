import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { patchOrderWizardFields } from "../../api/ordersApi.js";
import { getUserRole } from "../../utils/userRole.js";
import { canUpdateWorkflowStatus, resolveWorkflowControlRole } from "../../utils/workflowRole.js";
import { buildViewModelFromFullWizardData } from "../../utils/wizardDataToReviewViewModel.js";
import { ensureSocketThen, socket } from "../../socket";
import { getOrderChatConversationId, isOrderEligibleForChat, normalizeChatId } from "../../chatUtils";
import {
  resolveTailorIdWhenViewingAsTailor,
  syncTailorSessionFromTailorUser,
} from "../../utils/chatIdentity.js";
import {
  API_BASE_URL,
  DEFAULT_CUSTOMER_ID,
  defaultProfiles,
  GARMENT_REGEX,
  isPendingWorkflowStatus,
  normalizeOrder,
  normalizeStatus,
  resolveOrderWorkflowState,
  TAILOR_CURRENT_TASKS_VISIBLE_MAX,
  WORKFLOW_NON_COMPLETED_STATUSES,
  workflowStages,
} from "../constants";
import { getTailorProfileSelf, patchTailorProfileSelf } from "../../api/accountApi.js";
import { getPriorityScore, isTailorActiveTask } from "../../utils/workflowEngine.js";

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

function orderIsActiveCurrentTask(order) {
  const w = resolveOrderWorkflowState(order);
  return isTailorActiveTask(order) && w.internalStatus !== "completed";
}

export function useTailorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeTailorShopId = useMemo(() => resolveTailorIdWhenViewingAsTailor(user), [user]);
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
    void (async () => {
      try {
        await patchOrderWizardFields(raw, { isActive: true });
      } catch {
        /* UI selection still applies; server may be offline */
      }
      ensureSocketThen(() => {
        socket.emit("join_order_room", raw);
        socket.emit("order:selected", { orderId: raw });
      });
    })();
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
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  /** Latest `wizardData` from `measurement:reviewed` (includes normalized `image`). */
  const [reviewCardData, setReviewCardData] = useState(null);
  /** Dedupe when server emits to both tailor room + order room (same socket may be in both). */
  const measurementReviewDedupeRef = useRef("");

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
    try {
      const url = `${API_BASE_URL}/orders?tailorId=${encodeURIComponent(activeTailorShopId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      const normalizedData = data.map(toStoreOrder);

      setOrders(() => normalizedData);
      return normalizedData;
    } catch (err) {
      console.error("Error fetching orders", err);
      return null;
    }
  }, [activeTailorShopId]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

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
  }, [user?.id, user?.email, user?.role, activeTailorShopId]);

  useEffect(() => {
    socket.connect();

    const joinRoom = () => {
      console.log("[TailorDashboard] join_user:", activeTailorShopId);
      socket.emit("join_user", { userId: activeTailorShopId });
    };
    const handleNewNotification = (payload) => {
      if (payload?.type !== "new_message") return;
      if (normalizeChatId(payload?.senderId) === normalizeChatId(activeTailorShopId)) return;
      setNotifications((prev) => [
        ...prev,
        `New message from ${payload?.senderId || "Customer"}: ${payload?.content || ""}`,
      ]);
      if (!isChatOpenRef.current) {
        setUnreadChatCount((c) => Math.min(c + 1, 999));
      }
    };

    const onMeasurementUpdated = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      console.log("[Tailor Sync] measurement:updated", raw.id ?? raw._id ?? "");
      setOrders((prev) => upsertOrdersMerged(prev, raw, activeTailorShopId));
    };

    const onOrderNew = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      console.log("[Tailor Sync] order:new", raw.id ?? raw._id ?? "");
      setOrders((prev) => upsertOrdersMerged(prev, raw, activeTailorShopId));
    };

    const onOrderStatusUpdatedRelay = (data) => {
      if (!data) return;
      const raw = data.fullOrder;
      if (raw && typeof raw === "object") {
        console.log("[Tailor Sync] order:statusUpdated fullOrder", raw.id ?? raw._id ?? "");
        setOrders((prev) => upsertOrdersMerged(prev, raw, activeTailorShopId));
        return;
      }
      if (data.orderId == null) return;
      const oid = String(data.orderId);
      const st = data.status != null ? String(data.status) : "";
      if (!st) return;
      console.log("[Tailor Sync] order:statusUpdated patch", oid, st);
      setOrders((prev) => prev.map((order) => {
        const id = String(order.id ?? order._id ?? "");
        if (id !== oid) return order;
        return toStoreOrder(mergeOrderPatch(order, { status: st }));
      }));
    };

    const onMeasurementReviewed = (data) => {
      console.log("[CLIENT] Received review data:", data);
      console.log("[CLIENT] wizardData.image:", data?.wizardData?.image);

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
        console.warn("[Tailor Sync] measurement:reviewed ignored — no orderId", data);
        return;
      }

      const dedupeKey = `${oidRaw}:${data.timestamp ?? ""}`;
      if (measurementReviewDedupeRef.current === dedupeKey) {
        return;
      }
      measurementReviewDedupeRef.current = dedupeKey;

      console.log("[Tailor Sync] measurement:reviewed", oidRaw);
      const wd = data.wizardData;
      if (!wd || typeof wd !== "object" || Array.isArray(wd)) {
        console.warn("[Tailor Sync] measurement:reviewed ignored — bad wizardData");
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
    socket.on("measurement:updated", onMeasurementUpdated);
    socket.on("measurement:reviewed", onMeasurementReviewed);
    socket.on("order:new", onOrderNew);
    socket.on("order:statusUpdated", onOrderStatusUpdatedRelay);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("new_notification", handleNewNotification);
      socket.off("measurement:updated", onMeasurementUpdated);
      socket.off("measurement:reviewed", onMeasurementReviewed);
      socket.off("order:new", onOrderNew);
      socket.off("order:statusUpdated", onOrderStatusUpdatedRelay);
    };
  }, [fetchOrders, activeTailorShopId]);

  useEffect(() => {
    console.log("[TailorDashboard] isChatOpen:", isChatOpen);
  }, [isChatOpen]);

  useEffect(() => {
    console.log("[TailorDashboard] conversationId:", activeConversationId);
  }, [activeConversationId]);

  const tailorOrders = useMemo(
    () => orders.filter((order) => String(order.tailorId ?? "").trim() === String(activeTailorShopId).trim()),
    [orders, activeTailorShopId]
  );

  useEffect(() => {
    if (!activeTailorShopId) return;
    const joinOrderConversations = () => {
      const seen = new Set();
      for (const order of tailorOrders) {
        if (!isOrderEligibleForChat(order)) continue;
        const oid = order.id ?? order._id;
        const conv = getOrderChatConversationId(oid);
        const n = normalizeChatId(conv);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        socket.emit("join_conversation", { conversationId: n });
      }
    };
    joinOrderConversations();
    socket.on("connect", joinOrderConversations);
    return () => socket.off("connect", joinOrderConversations);
  }, [activeTailorShopId, tailorOrders]);

  const activeOrder = useMemo(() => {
    if (tailorOrders.length === 0) return null;
    return tailorOrders.find((order) => order.id === activeOrderId) || tailorOrders[0];
  }, [tailorOrders, activeOrderId]);

  useEffect(() => {
    if (!activeOrder && tailorOrders.length > 0) setActiveOrderId(tailorOrders[0].id);
  }, [activeOrder, tailorOrders, setActiveOrderId]);

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
    const pending = tailorOrders.filter((o) => isPendingWorkflowStatus(resolveOrderWorkflowState(o).internalStatus)).length;
    const inProgress = tailorOrders.filter((o) => {
      const s = resolveOrderWorkflowState(o).internalStatus;
      if (s === "completed") return false;
      return WORKFLOW_NON_COMPLETED_STATUSES.has(s) && !isPendingWorkflowStatus(s);
    }).length;
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
          resolveOrderWorkflowState(order).internalStatus !== "completed"
      ),
    [orders, activeTailorShopId]
  );

  const newOrders = useMemo(() => {
    const nowMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return tailorOrders
      .filter((order) => isPendingWorkflowStatus(resolveOrderWorkflowState(order).internalStatus))
      .filter((order) => {
        const orderTime = new Date(order.createdAt || order.date).getTime();
        return Number.isFinite(orderTime) && nowMs - orderTime <= oneDayMs;
      })
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [tailorOrders]);

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
    const resolvedPatch = resolveOrderWorkflowState({ status: normalizedStatus });
    setOrders((prev) =>
      prev.map((o) =>
        String(o.id) === String(orderId)
          ? toStoreOrder(
              mergeOrderPatch(o, {
                status: normalizedStatus,
                currentStepIndex: resolvedPatch.workflowIndex,
                currentStep: resolvedPatch.workflowIndex,
              })
            )
          : o
      )
    );

    try {
      const updated = await patchOrderWizardFields(String(orderId), {
        status: normalizedStatus,
        currentStep: resolvedPatch.workflowIndex,
        currentStepIndex: resolvedPatch.workflowIndex,
      });
      const oid = String(updated._id ?? updated.id ?? orderId);
      ensureSocketThen(() => {
        socket.emit("join_order_room", oid);
        socket.emit("order:statusUpdated", {
          orderId: oid,
          status: normalizedStatus,
        });
      });
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
      if (!oid) return;
      const tailorId = String(activeTailorShopId || "").trim();
      if (!tailorId) return;

      // Optimistic: ensure it shows up in `tailorOrders` immediately.
      setOrders((prev) => {
        const exists = prev.some((o) => String(o.id ?? o._id ?? "") === oid || String(o._id ?? "") === oid);
        if (exists) {
          return prev.map((o) => {
            const idMatch =
              String(o.id ?? o._id ?? "") === oid || String(o._id ?? "") === oid;
            if (!idMatch) return o;
            return toStoreOrder(
              mergeOrderPatch(o, {
                tailorId,
                status: normalizeStatus(o.status || "pending"),
              })
            );
          });
        }

        const hinted =
          popupHint && typeof popupHint === "object"
            ? {
                id: oid,
                tailorId,
                customerId: popupHint.customerId || "",
                customerName: popupHint.customerName || "",
                garmentType: popupHint.dressType || popupHint.garmentType || "",
                notes: popupHint.notes || "",
                status: "pending",
                createdAt: new Date().toISOString(),
              }
            : { id: oid, tailorId, status: "pending", createdAt: new Date().toISOString() };
        return [toStoreOrder(hinted), ...prev];
      });

      try {
        await patchOrderWizardFields(oid, {
          tailorId,
          isActive: true,
          status: "pending",
        });
        await fetchOrders();
      } catch {
        await fetchOrders();
        setNotifications((prev) => ["Could not accept the order right now.", ...prev]);
      }
    },
    [activeTailorShopId, fetchOrders, setNotifications, setOrders]
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

  const openChatForOrder = (order) => {
    if (!order) {
      return;
    }
    if (!isOrderEligibleForChat(order)) {
      return;
    }
    const targetCustomerId = normalizeChatId(order.customerId) || DEFAULT_CUSTOMER_ID;
    const oid = String(order.id ?? order._id ?? "").trim();
    const conversationId = getOrderChatConversationId(oid);

    setActiveChatCustomer({
      id: targetCustomerId,
      name: order.customerName || "Customer",
    });
    setActiveConversationId(conversationId);

    setActiveOrderId(order.id);
    setIsChatOpen(true);
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
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
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
    const pend = tailorOrders.filter((o) => isPendingWorkflowStatus(resolveOrderWorkflowState(o).internalStatus));
    if (pend[0]) {
      lines.push(
        `Finish ${pend[0].customerName} ${pend[0].garmentType} — Due ${pend[0].dueDate || pend[0].date || "soon"}`
      );
    }
    const any = tailorOrders.find((o) => resolveOrderWorkflowState(o).internalStatus !== "completed");
    if (any && lines.length < 2) {
      lines.push(`Review ${any.customerName} request — Awaiting approval`);
    }
    if (lines.length < 2 && tailorOrders[0]) {
      lines.push(`${tailorOrders[0].garmentType} for ${tailorOrders[0].customerName} — in workflow`);
    }
    return lines.slice(0, 2);
  }, [tailorOrders]);

  const calendarPreview = useMemo(
    () =>
      [...tailorOrders]
        .filter((o) => resolveOrderWorkflowState(o).internalStatus !== "completed")
        .filter((o) => o.dueDate || o.date)
        .sort((a, b) => String(a.dueDate || a.date).localeCompare(String(b.dueDate || b.date)))
        .slice(0, 2),
    [tailorOrders]
  );

  /** Same top orders as “Current Tasks”, limited to statuses that still need measurement/wizard review. */
  const measurementsCandidates = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const needsReview = (o) => {
      const s = resolveOrderWorkflowState(o).internalStatus;
      return s === "pending" || s === "order_placed" || s === "measurements_verified";
    };
    const topCurrent = [...list]
      .filter(orderIsActiveCurrentTask)
      .sort((a, b) => getPriorityScore(a) - getPriorityScore(b))
      .slice(0, TAILOR_CURRENT_TASKS_VISIBLE_MAX);
    return topCurrent.filter(needsReview);
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
    if (!activeOrder?.dueDate) return "—";
    const d = new Date(activeOrder.dueDate);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (!Number.isFinite(diff)) return "—";
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
    tailorOrders,
    activeOrder,
    upcomingOrders,
    newOrders,
    fetchOrders,
    updateOrderStatus,
    acceptOrderIntoCurrentTasks,
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
