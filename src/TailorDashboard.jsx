import React, { useMemo } from "react";
import DashboardNavbar from "./components/DashboardNavbar";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import ChatWindow from "./ChatWindow";
import TdDashboardOverview from "./tailorDashboard/components/TdDashboardOverview";
import WizardOrderReviewModal from "./tailorDashboard/components/WizardOrderReviewModal";
import { TailorDashboardChatContext } from "./context/TailorDashboardChatContext.jsx";
import { DEFAULT_CUSTOMER_ID } from "./tailorDashboard/constants";
import { useTailorDashboard } from "./tailorDashboard/hooks/useTailorDashboard";

export default function TailorDashboard() {
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
      <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
        <LandingStylePageBackground />
        <DashboardNavbar />
        <div className="relative z-10 mx-auto max-w-7xl space-y-10 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <TdDashboardOverview {...dash} />
        </div>
        <ChatWindow
          isOpen={dash.isChatOpen}
          onClose={() => dash.setIsChatOpen(false)}
          senderId={dash.activeTailorShopId}
          receiverId={dash.activeChatCustomer.id || DEFAULT_CUSTOMER_ID}
          receiverName={dash.activeChatCustomer.name || "Customer"}
          conversationId={dash.activeConversationId}
        />
        <WizardOrderReviewModal
          order={dash.reviewModalDisplayOrder}
          open={dash.reviewModalOpen}
          onClose={dash.closeMeasurementsReview}
          updateOrderStatus={dash.updateOrderStatus}
        />
      </div>
    </TailorDashboardChatContext.Provider>
  );
}
