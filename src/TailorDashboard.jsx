import React from "react";
import DashboardNavbar from "./components/DashboardNavbar";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import ChatWindow from "./ChatWindow";
import TdDashboardOverview from "./tailorDashboard/components/TdDashboardOverview";
import TdDashboardWorkspace from "./tailorDashboard/components/TdDashboardWorkspace";
import { DEFAULT_CUSTOMER_ID, tailorId } from "./tailorDashboard/constants";
import { useTailorDashboard } from "./tailorDashboard/hooks/useTailorDashboard";

export default function TailorDashboard() {
  const dash = useTailorDashboard();

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
      <LandingStylePageBackground />
      <DashboardNavbar />
      <div className="relative z-10 mx-auto max-w-7xl space-y-10 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <TdDashboardOverview {...dash} />
        <TdDashboardWorkspace {...dash} />
      </div>
      <ChatWindow
        isOpen={dash.isChatOpen}
        onClose={() => dash.setIsChatOpen(false)}
        senderId={tailorId}
        receiverId={dash.activeChatCustomer.id || DEFAULT_CUSTOMER_ID}
        receiverName={dash.activeChatCustomer.name || "Customer"}
        conversationId={dash.activeConversationId}
      />
    </div>
  );
}
