import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import TailorDashboardAmbient from "./tailorDashboard/components/TailorDashboardAmbient.jsx";
import TdDashboardOverview from "./tailorDashboard/components/TdDashboardOverview";
import TailorDashboardSidebar from "./tailorDashboard/components/TailorDashboardSidebar.jsx";
import { TD_PAGE_BG } from "./tailorDashboard/tailorDashboardClassNames.js";
import WizardOrderReviewModal from "./tailorDashboard/components/WizardOrderReviewModal.jsx";
import OrderPopup from "./tailorDashboard/components/OrderPopup.jsx";
import RejectOrderModal from "./tailorDashboard/components/RejectOrderModal.jsx";
import { TailorDashboardChatContext } from "./context/TailorDashboardChatContext.jsx";
import { useTailorDashboard } from "./tailorDashboard/hooks/useTailorDashboard";
import { ensureSocketThen, socket } from "./socket.js";
import { useAuth } from "./context/AuthContext.jsx";

const POPUP_AUTO_DISMISS_MS = 60_000;

export default function TailorDashboard() {
  const dash = useTailorDashboard();
  const { user } = useAuth();
  const location = useLocation();
  const [incomingOrder, setIncomingOrder] = useState(null);
  const [popupRejectBusy, setPopupRejectBusy] = useState(false);
  const [popupRejectOpen, setPopupRejectOpen] = useState(false);
  /** Order snapshot for decline flow after incoming popup is closed */
  const [rejectSnapshot, setRejectSnapshot] = useState(null);
  const incomingRef = useRef(null);
  const autoCloseRef = useRef(null);

  incomingRef.current = incomingOrder;

  const dismissIncomingOrder = useCallback(() => {
    if (autoCloseRef.current != null) {
      window.clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    setIncomingOrder(null);
  }, []);

  const onIncomingOrderInterested = useCallback(() => {
    const o = incomingRef.current;
    if (!o?.orderId) return;
    const oid = String(o.orderId).trim();
    if (!oid) return;
    void dash.acceptOrderIntoCurrentTasks?.(oid, o);
    dismissIncomingOrder();
  }, [dash, dismissIncomingOrder]);

  const onIncomingOrderDeclineClick = useCallback(() => {
    const o = incomingRef.current;
    if (!o?.orderId) return;
    setRejectSnapshot(o);
    dismissIncomingOrder();
    setPopupRejectOpen(true);
  }, [dismissIncomingOrder]);

  const onPopupRejectClose = useCallback(() => {
    if (popupRejectBusy) return;
    setPopupRejectOpen(false);
    setRejectSnapshot(null);
  }, [popupRejectBusy]);

  const onPopupRejectConfirm = useCallback(
    async (reason) => {
      const o = rejectSnapshot;
      const oid = o?.orderId != null ? String(o.orderId).trim() : "";
      if (!oid || !dash.rejectOrderFromPending) return;
      setPopupRejectBusy(true);
      try {
        const ok = await dash.rejectOrderFromPending(oid, o, reason);
        if (ok) {
          setPopupRejectOpen(false);
          setRejectSnapshot(null);
          dismissIncomingOrder();
        }
      } finally {
        setPopupRejectBusy(false);
      }
    },
    [dash, dismissIncomingOrder, rejectSnapshot]
  );

  useEffect(() => {
    // ROLE-BASED: only tailors should attach this listener
    if (!user || user.role !== "tailor") return undefined;

    const allowed = location.pathname === "/tailor/dashboard" || location.pathname === "/tailor-dashboard";
    if (!allowed) return undefined;

    const tailorShopId = String(dash.activeTailorShopId || "").trim();
    console.log("[TailorDashboard] logged user", {
      id: user?.id,
      tailorShopId: user?.tailorShopId,
      tailorId: user?.tailorId,
      role: user?.role,
    });
    console.log("[TailorDashboard] activeTailorShopId", tailorShopId || "(none)");

    const joinTailorRoom = () => {
      if (!tailorShopId) return;
      console.log("[TailorDashboard] joined room", tailorShopId);
      socket.emit("join_user", { userId: tailorShopId });
    };
    ensureSocketThen(joinTailorRoom);
    socket.on("connect", joinTailorRoom);

    const handlePopup = (payload) => {
      // HARD SAFETY: ignore unless tailor + on tailor dashboard route
      if (!user || user.role !== "tailor") return;
      const okRoute =
        location.pathname === "/tailor/dashboard" || location.pathname === "/tailor-dashboard";
      if (!okRoute) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
      if (payload.orderId == null || String(payload.orderId).trim() === "") return;
      console.log("[TailorDashboard] tailor:popup", String(payload.orderId).trim());
      setIncomingOrder({
        orderId: payload.orderId,
        dressType: payload.garmentType || payload.dressType || "—",
        dueDate: payload.budget != null ? String(payload.budget) : "—",
        notes: payload.message || "New order request",
        customerId: payload.customerId || "",
        location: payload.location || null,
      });
      if (autoCloseRef.current != null) window.clearTimeout(autoCloseRef.current);
      autoCloseRef.current = window.setTimeout(() => {
        setIncomingOrder(null);
        autoCloseRef.current = null;
      }, POPUP_AUTO_DISMISS_MS);
    };

    socket.on("tailor:popup", handlePopup);
    return () => {
      socket.off("connect", joinTailorRoom);
      socket.off("tailor:popup", handlePopup);
      dismissIncomingOrder();
    };
  }, [dash.activeTailorShopId, dismissIncomingOrder, location.pathname, user]);

  const tailorChatApi = useMemo(
    () => ({
      openChatFromActiveOrder: dash.openChatFromActiveOrder,
      activeChatCustomer: dash.activeChatCustomer,
      activeConversationId: dash.activeConversationId,
      senderId: dash.activeTailorShopId,
      unreadChatCount: dash.unreadChatCount,
    }),
    [
      dash.openChatFromActiveOrder,
      dash.activeChatCustomer,
      dash.activeConversationId,
      dash.activeTailorShopId,
      dash.unreadChatCount,
    ]
  );

  return (
    <TailorDashboardChatContext.Provider value={tailorChatApi}>
      <div
        className={`relative isolate flex min-h-screen min-h-[100dvh] w-full overflow-x-hidden font-['Inter',system-ui,sans-serif] antialiased ${TD_PAGE_BG} text-[#4B5563]`}
      >
        <LandingStylePageBackground />
        <TailorDashboardAmbient />
        <TailorDashboardSidebar unreadChatCount={dash.unreadChatCount} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {typeof document !== "undefined" && popupRejectOpen
            ? createPortal(
                <RejectOrderModal
                  open={popupRejectOpen}
                  orderLabel={
                    rejectSnapshot?.dressType && String(rejectSnapshot.dressType).trim() !== "—"
                      ? String(rejectSnapshot.dressType).trim()
                      : "this request"
                  }
                  busy={popupRejectBusy}
                  onClose={onPopupRejectClose}
                  onConfirm={onPopupRejectConfirm}
                />,
                document.body
              )
            : null}
          {typeof document !== "undefined" && incomingOrder && !popupRejectOpen
            ? createPortal(
                <OrderPopup
                  key={incomingOrder.orderId}
                  order={incomingOrder}
                  onInterested={onIncomingOrderInterested}
                  onIgnore={onIncomingOrderDeclineClick}
                />,
                document.body
              )
            : null}
          <main className="relative z-10 mx-auto w-full max-w-[1280px] flex-1 space-y-4 px-3 pb-8 pt-3 sm:px-4 sm:pt-4 lg:px-5 lg:pt-5">
            <WizardOrderReviewModal
              order={dash.reviewModalDisplayOrder}
              open={dash.reviewModalOpen}
              onClose={dash.closeMeasurementsReview}
              acceptOrderIntoCurrentTasks={dash.acceptOrderIntoCurrentTasks}
            />
            <TdDashboardOverview {...dash} />
          </main>
        </div>
        {/** Temporarily disabled to avoid double popups (keep logic untouched). */}
        {null}
      </div>
    </TailorDashboardChatContext.Provider>
  );
}
