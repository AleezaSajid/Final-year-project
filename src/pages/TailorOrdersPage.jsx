import React, { useMemo } from "react";
import { LandingStylePageBackground } from "../components/LandingStylePageBackground.jsx";
import TailorDashboardAmbient from "../tailorDashboard/components/TailorDashboardAmbient.jsx";
import TailorDashboardSidebar from "../tailorDashboard/components/TailorDashboardSidebar.jsx";
import TdTailorOrdersList from "../tailorDashboard/components/TdTailorOrdersList.jsx";
import WizardOrderReviewModal from "../tailorDashboard/components/WizardOrderReviewModal.jsx";
import { TailorDashboardChatContext } from "../context/TailorDashboardChatContext.jsx";
import { useTailorDashboard } from "../tailorDashboard/hooks/useTailorDashboard.js";
import { TD_PAGE_BG } from "../tailorDashboard/tailorDashboardClassNames.js";

export default function TailorOrdersPage() {
  const dash = useTailorDashboard();

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
          <main className="relative z-10 mx-auto w-full max-w-[1280px] flex-1 space-y-4 px-3 pb-8 pt-3 sm:px-4 sm:pt-4 lg:px-5 lg:pt-5">
            <WizardOrderReviewModal
              order={dash.reviewModalDisplayOrder}
              open={dash.reviewModalOpen}
              onClose={dash.closeMeasurementsReview}
              acceptOrderIntoCurrentTasks={dash.acceptOrderIntoCurrentTasks}
            />
            <TdTailorOrdersList
              tailorOrders={dash.tailorOrders}
              updateOrderStatus={dash.updateOrderStatus}
              acceptOrderIntoCurrentTasks={dash.acceptOrderIntoCurrentTasks}
              navigate={dash.navigate}
              setActiveOrderId={dash.setActiveOrderId}
              fetchOrders={dash.fetchOrders}
            />
          </main>
        </div>
      </div>
    </TailorDashboardChatContext.Provider>
  );
}
