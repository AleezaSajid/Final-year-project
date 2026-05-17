import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DashboardNavbar from "../components/DashboardNavbar.jsx";
import { LandingStylePageBackground } from "../components/LandingStylePageBackground.jsx";
import TailorWhatsAppWorkspace from "../components/chat/TailorWhatsAppWorkspace.jsx";
import { TailorDashboardChatContext } from "../context/TailorDashboardChatContext.jsx";
import { useTailorDashboard } from "../tailorDashboard/hooks/useTailorDashboard.js";

export default function TailorMessagesPage() {
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
      <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
        <LandingStylePageBackground />
        <DashboardNavbar />
        <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-8">
          <div className="mb-3 flex shrink-0 items-center gap-3">
            <Link
              to="/tailor/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white/50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Messages</h1>
          </div>
          <div className="min-h-0 flex-1 pb-2">
            <TailorWhatsAppWorkspace
              fullPage
              tailorChatConversations={dash.tailorChatConversations}
              orders={dash.orders}
              openChatForOrder={dash.openChatForOrder}
              acceptOrderIntoCurrentTasks={dash.acceptOrderIntoCurrentTasks}
              activeConversationId={dash.activeConversationId}
              activeChatCustomer={dash.activeChatCustomer}
              activeTailorShopId={dash.activeTailorShopId}
              setActiveOrderId={dash.setActiveOrderId}
            />
          </div>
        </main>
      </div>
    </TailorDashboardChatContext.Provider>
  );
}
