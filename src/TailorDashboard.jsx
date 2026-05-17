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
      <div
        className={`relative isolate flex min-h-screen min-h-[100dvh] w-full overflow-x-hidden font-['Inter',system-ui,sans-serif] antialiased ${TD_PAGE_BG} text-[#4B5563]`}
      >
        <LandingStylePageBackground />
        <TailorDashboardAmbient />
        <TailorDashboardSidebar unreadChatCount={dash.unreadChatCount} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
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
