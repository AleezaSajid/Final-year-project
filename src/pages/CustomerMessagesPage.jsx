import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DashboardNavbar from "../components/DashboardNavbar.jsx";
import { LandingStylePageBackground } from "../components/LandingStylePageBackground.jsx";
import CustomerWhatsAppWorkspace from "../components/chat/CustomerWhatsAppWorkspace.jsx";
import { useCustomerChat } from "../context/CustomerChatContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { listOrdersForCustomer } from "../api/ordersApi.js";
import { resolveCustomerIdForChat } from "../utils/chatIdentity.js";
function sortOrdersByNewestFirst(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(a.createdAt || a.date || 0).getTime();
    const tb = new Date(b.createdAt || b.date || 0).getTime();
    return tb - ta;
  });
}

export default function CustomerMessagesPage() {
  const { user } = useAuth();
  const { customerChatConversations, customerId: chatCustomerId } = useCustomerChat();
  const [orders, setOrders] = useState([]);

  const fetchOrders = useCallback(async () => {
    try {
      const cid = resolveCustomerIdForChat(user);
      const list = await listOrdersForCustomer(cid);
      setOrders(sortOrdersByNewestFirst(list));
    } catch {
      setOrders([]);
    }
  }, [user]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#eceff3] font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
      <LandingStylePageBackground />
      <DashboardNavbar />
      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-8">
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <Link
            to="/customer/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white/50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Messages</h1>
        </div>
        <div className="min-h-0 flex-1 pb-2">
          <CustomerWhatsAppWorkspace
            fullPage
            customerChatConversations={customerChatConversations}
            orders={orders}
            customerId={chatCustomerId}
            setActiveOrderId={() => {}}
          />
        </div>
      </main>
    </div>
  );
}
