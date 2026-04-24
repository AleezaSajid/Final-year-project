import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { buildOrderStatusSocketPayload } from "../../utils/orderLiveStatus.js";
import { getUserRole } from "../../utils/userRole.js";
import { canUpdateWorkflowStatus, resolveWorkflowControlRole } from "../../utils/workflowRole.js";
import { buildViewModelFromFullWizardData } from "../../utils/wizardDataToReviewViewModel.js";
import { ensureSocketThen, socket } from "../../socket";
import { getConversationId, normalizeChatId } from "../../chatUtils";
import {
  API_BASE_URL,
  DEFAULT_CUSTOMER_ID,
  GARMENT_REGEX,
  normalizeOrder,
  normalizeStatus,
  readProfilesFromStorage,
  seedOrders,
  SHARED_ORDER_STORAGE_KEY,
  tailorId,
  TAILOR_PROFILE_STORAGE_KEY,
  workflowStages,
  getStatusIndex,
} from "../constants";

/** Use the snapshot that still has image data (socket may be slim; orders[] may have full DB orderPayload). */
function pickRichestWizardSnapshot(candidates) {
  const list = candidates.filter((s) => s && typeof s === "object" && !Array.isArray(s));
  if (!list.length) return null;
  const score = (s) => {
    let n = 0;
    if (typeof s.image === "string" && s.image.length > 0) n += s.image.length;
    const d = s.referenceImage?.dataUrl;
    if (typeof d === "string" && d.length > 0) n += d.length;
    return n;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

export function useTailorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(readProfilesFromStorage);

  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem(SHARED_ORDER_STORAGE_KEY);
      return saved ? JSON.parse(saved).map(normalizeOrder) : seedOrders.map(normalizeOrder);
    } catch {
      return seedOrders.map(normalizeOrder);
    }
  });

  const [activeOrderId, _setActiveOrderId] = useState("");

  const setActiveOrderId = useCallback((id) => {
    const next = id != null ? String(id) : "";
    _setActiveOrderId(next);
    const raw = next.trim();
    if (!raw) return;
    ensureSocketThen(() => {
      socket.emit("join_order_room", raw);
      socket.emit("order:active", { orderId: raw });
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
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  /** Latest `wizardData` from `measurement:reviewed` (includes normalized `image`). */
  const [reviewCardData, setReviewCardData] = useState(null);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/tailor/${tailorId}`);
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      const normalizedData = data.map(normalizeOrder);

      setOrders((prevOrders) => {
        if (normalizedData.length > prevOrders.length) {
          const newOrderItem = normalizedData[normalizedData.length - 1];
          setNotifications((prev) => [...prev, `New order from ${newOrderItem.customerId}`]);
        }
        return normalizedData;
      });
      return normalizedData;
    } catch (err) {
      console.error("Error fetching orders", err);
      return null;
    }
  };

  useEffect(() => {
    localStorage.setItem(SHARED_ORDER_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);

    return () => clearInterval(interval);
  }, [tailorId]);

  useEffect(() => {
    localStorage.setItem(TAILOR_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    socket.connect();

    const joinRoom = () => {
      console.log("[TailorDashboard] join_user:", tailorId);
      socket.emit("join_user", { userId: tailorId });
    };
    const handleNewNotification = (payload) => {
      if (payload?.type !== "new_message") return;
      setNotifications((prev) => [
        ...prev,
        `New message from ${payload?.senderId || "Customer"}: ${payload?.content || ""}`,
      ]);
      if (!isChatOpenRef.current) {
        setUnreadChatCount((c) => Math.min(c + 1, 999));
      }
    };

    const onMeasurementUpdated = (payload) => {
      const raw = payload && payload.order;
      if (!raw || typeof raw !== "object") return;
      const n = normalizeOrder(raw);
      if (n.tailorId && String(n.tailorId) !== String(tailorId)) {
        return;
      }
      setOrders((prev) => {
        const i = prev.findIndex((o) => String(o.id) === String(n.id));
        if (i === -1) {
          return [...prev, n];
        }
        const next = [...prev];
        next[i] = { ...next[i], ...n };
        return next;
      });
    };

    const onMeasurementReviewed = (data) => {
      console.log("[CLIENT] Received review data:", data);
      console.log("[CLIENT] wizardData.image:", data?.wizardData?.image);

      if (!data || data.orderId == null) return;
      const wd = data.wizardData;
      if (!wd || typeof wd !== "object" || Array.isArray(wd)) return;

      if (data?.wizardData) {
        setReviewCardData(data.wizardData);
      }

      const id = String(data.orderId);

      if (data?.wizardImageDeferred) {
        void (async () => {
          const list = await fetchOrders();
          if (!list) return;
          const raw = list.find((o) => String(o.id) === id);
          if (!raw) return;
          const refreshed = normalizeOrder(raw);
          setReviewModalOrder(refreshed);
          const fullWd = refreshed.wizardData || refreshed.orderPayload;
          if (fullWd && typeof fullWd === "object" && !Array.isArray(fullWd)) {
            setReviewCardData(fullWd);
          }
        })();
      }
      setOrders((prev) => {
        const i = prev.findIndex((o) => String(o.id) === id);
        const prevRow = i >= 0 ? prev[i] : {};
        const view = buildViewModelFromFullWizardData(wd, {
          ...prevRow,
          id,
          _id: id,
          customerId: prevRow.customerId,
          clientOrderId: prevRow.clientOrderId,
          createdAt: prevRow.createdAt,
        });
        const tail = data.tailorId != null ? String(data.tailorId) : tailorId;
        const merged = {
          ...prevRow,
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
        const row = normalizeOrder(
          i === -1
            ? { ...merged, status: "pending" }
            : { ...prevRow, ...merged, status: prevRow.status, dueDate: prevRow.dueDate, date: prevRow.date, createdAt: prevRow.createdAt }
        );
        if (row.tailorId && String(row.tailorId) !== String(tailorId)) {
          return prev;
        }
        setReviewModalOrder(row);
        setReviewModalOpen(true);
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

    return () => {
      socket.off("connect", joinRoom);
      socket.off("new_notification", handleNewNotification);
      socket.off("measurement:updated", onMeasurementUpdated);
      socket.off("measurement:reviewed", onMeasurementReviewed);
    };
  }, []);

  useEffect(() => {
    console.log("[TailorDashboard] isChatOpen:", isChatOpen);
  }, [isChatOpen]);

  useEffect(() => {
    console.log("[TailorDashboard] conversationId:", activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    const syncProfilesFromStorage = (event) => {
      if (event.key && event.key !== TAILOR_PROFILE_STORAGE_KEY) return;
      setProfiles(readProfilesFromStorage());
    };
    window.addEventListener("storage", syncProfilesFromStorage);
    window.addEventListener("focus", syncProfilesFromStorage);
    return () => {
      window.removeEventListener("storage", syncProfilesFromStorage);
      window.removeEventListener("focus", syncProfilesFromStorage);
    };
  }, []);

  const tailorOrders = useMemo(
    () => orders.filter((order) => order.tailorId === tailorId),
    [orders]
  );

  const activeOrder = useMemo(() => {
    if (tailorOrders.length === 0) return null;
    return tailorOrders.find((order) => order.id === activeOrderId) || tailorOrders[0];
  }, [tailorOrders, activeOrderId]);

  useEffect(() => {
    if (!activeOrder && tailorOrders.length > 0) setActiveOrderId(tailorOrders[0].id);
  }, [activeOrder, tailorOrders, setActiveOrderId]);

  useEffect(() => {
    const current = profiles[tailorId] || {};
    setProfileForm({
      name: current.name || "",
      skills: current.skills || "",
      experience: String(current.experience || "").replace(" years", ""),
    });
  }, [profiles]);

  const stats = useMemo(() => {
    const total = tailorOrders.length;
    const pending = tailorOrders.filter((o) => o.status === "pending").length;
    const inProgress = tailorOrders.filter((o) => o.status !== "pending" && o.status !== "completed").length;
    const completed = tailorOrders.filter((o) => o.status === "completed").length;
    return { total, pending, inProgress, completed };
  }, [tailorOrders]);

  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return tailorOrders
      .filter((order) => order.status === "completed")
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
    () => orders.filter((order) => normalizeStatus(order.status) !== "completed"),
    [orders]
  );

  const newOrders = useMemo(() => {
    const nowMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return tailorOrders
      .filter((order) => order.status === "pending")
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
    setOrders((prev) =>
      prev.map((o) =>
        String(o.id) === String(orderId)
          ? { ...o, status: normalizedStatus, workflowStep: getStatusIndex(normalizedStatus) }
          : o
      )
    );

    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        await fetchOrders();
        setNotifications((prev) => ["Could not sync status with server.", ...prev]);
        return;
      }
      const statusPayload = buildOrderStatusSocketPayload(orderId, normalizedStatus);
      ensureSocketThen(() => {
        socket.emit("join_order_room", String(orderId));
        socket.emit("order:statusUpdate", statusPayload);
      });
      await fetchOrders();
    } catch {
      await fetchOrders();
      setNotifications((prev) => ["Could not sync status with server.", ...prev]);
    }
  };

  const advanceWorkflow = async () => {
    if (!activeOrder) return;
    setIsAdvancing(true);
    const currentIndex = getStatusIndex(activeOrder.status);
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
    const targetCustomerId = normalizeChatId(order.customerId) || DEFAULT_CUSTOMER_ID;

    const conversationId = getConversationId(tailorId, targetCustomerId);

    setActiveChatCustomer({
      id: targetCustomerId,
      name: order.customerName || "Customer",
    });
    setActiveConversationId(conversationId);

    setActiveOrderId(order.id);
    setIsChatOpen(true);
  };

  const openChatFromActiveOrder = () => {
    const targetOrder = activeOrder || tailorOrders[0] || null;
    if (targetOrder) {
      openChatForOrder(targetOrder);
      return;
    }
    const fallbackCustomerId = normalizeChatId(activeChatCustomer.id) || DEFAULT_CUSTOMER_ID;
    setActiveConversationId(getConversationId(tailorId, fallbackCustomerId));
    setActiveChatCustomer((prev) => ({
      id: fallbackCustomerId,
      name: prev.name || "Customer",
    }));
    setIsChatOpen(true);
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
          tailorId,
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
      const createdOrder = normalizeOrder(payload);
      setOrders((prev) => [createdOrder, ...prev]);
      setActiveOrderId(createdOrder.id);
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
      [tailorId]: {
        ...(prev[tailorId] || {}),
        name: trimmedName || prev[tailorId]?.name || "",
        skills: trimmedSkills || prev[tailorId]?.skills || "",
        experience:
          Number.isFinite(parsedExperience) && parsedExperience >= 0
            ? `${parsedExperience} years`
            : prev[tailorId]?.experience || "",
      },
    }));
    setNotifications((prev) => ["Tailor profile updated successfully.", ...prev]);
  };

  const notificationText = (note) => (typeof note === "string" ? note : note?.text || "");

  const welcomeName = useMemo(() => {
    const raw = profiles[tailorId]?.name || "Michael";
    const first = String(raw).trim().split(/\s+/)[0];
    return first || raw;
  }, [profiles]);

  const currentTaskLines = useMemo(() => {
    const lines = [];
    const pend = tailorOrders.filter((o) => normalizeStatus(o.status) === "pending");
    if (pend[0]) {
      lines.push(
        `Finish ${pend[0].customerName} ${pend[0].garmentType} — Due ${pend[0].dueDate || pend[0].date || "soon"}`
      );
    }
    const any = tailorOrders.find((o) => normalizeStatus(o.status) !== "completed");
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
        .filter((o) => o.dueDate || o.date)
        .sort((a, b) => String(a.dueDate || a.date).localeCompare(String(b.dueDate || b.date)))
        .slice(0, 2),
    [tailorOrders]
  );

  const measurementsCandidates = useMemo(
    () =>
      newOrders.length
        ? newOrders.slice(0, 3)
        : tailorOrders.filter((o) => normalizeStatus(o.status) === "pending").slice(0, 3),
    [newOrders, tailorOrders]
  );

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
    const idx = getStatusIndex(activeOrder.status);
    return Math.round(((idx + 1) / workflowStages.length) * 100);
  }, [activeOrder]);

  const openMeasurementsReview = useCallback((order) => {
    if (!order) return;
    setActiveOrderId(String(order.id));
    setReviewCardData(null);
    setReviewModalOrder(normalizeOrder(order));
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
    profiles,
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
