import { createContext, useContext } from "react";

/**
 * Provided only by {@link TailorDashboard} so the navbar can open the same ChatWindow / conversation
 * as the workspace “Open Chat” actions (no duplicate state).
 */
export const TailorDashboardChatContext = createContext(null);

export function useTailorDashboardChat() {
  return useContext(TailorDashboardChatContext) ?? {
    openChatFromActiveOrder: () => {},
    activeChatCustomer: { id: "", name: "Customer" },
    activeConversationId: "",
    senderId: "T-A1",
    unreadChatCount: 0,
  };
}
