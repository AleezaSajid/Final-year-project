import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import DashboardNavbar from "./components/DashboardNavbar";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import TdDashboardOverview from "./tailorDashboard/components/TdDashboardOverview";
import WizardOrderReviewModal from "./tailorDashboard/components/WizardOrderReviewModal.jsx";
import OrderPopup from "./tailorDashboard/components/OrderPopup.jsx";
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

  useEffect(() => {
    // ROLE-BASED: only tailors should attach this listener
    if (!user || user.role !== "tailor") return undefined;

    const allowed = location.pathname === "/tailor/dashboard" || location.pathname === "/tailor-dashboard";
    if (!allowed) return undefined;

    // Ensure this tailor joins its room (room name MUST be tailorShopId).
    const tailorShopId = dash.activeTailorShopId;
    if (tailorShopId) {
      ensureSocketThen(() => {
        socket.emit("join_user", { userId: tailorShopId });
      });
    }

    const handlePopup = (payload) => {
      // HARD SAFETY: ignore unless tailor + on tailor dashboard route
      if (!user || user.role !== "tailor") return;
      const okRoute =
        location.pathname === "/tailor/dashboard" || location.pathname === "/tailor-dashboard";
      if (!okRoute) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
      if (payload.orderId == null || String(payload.orderId).trim() === "") return;
      // Normalize to existing popup shape.
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
      <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
        <LandingStylePageBackground />
        <DashboardNavbar />
        {typeof document !== "undefined" && incomingOrder
          ? createPortal(
              <OrderPopup
                key={incomingOrder.orderId}
                order={incomingOrder}
                onInterested={onIncomingOrderInterested}
                onIgnore={dismissIncomingOrder}
              />,
              document.body
            )
          : null}
        <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <WizardOrderReviewModal
            order={dash.reviewModalDisplayOrder}
            open={dash.reviewModalOpen}
            onClose={dash.closeMeasurementsReview}
            acceptOrderIntoCurrentTasks={dash.acceptOrderIntoCurrentTasks}
          />
          <TdDashboardOverview {...dash} />
        </div>
        {/** Temporarily disabled to avoid double popups (keep logic untouched). */}
        {null}
      </div>
    </TailorDashboardChatContext.Provider>
  );
}
