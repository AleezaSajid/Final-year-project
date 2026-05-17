import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { displayChatActorName, normalizeConversationId } from "../../chatUtils.js";
import {
  avatarClassName,
  chatInitials,
  chatStatusBadge,
  shortOrderId,
} from "./chatWorkspaceUi.js";

function sortConversationsDesc(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const ta = new Date(a?.lastMessageAt || a?.updatedAt || 0).getTime();
    const tb = new Date(b?.lastMessageAt || b?.updatedAt || 0).getTime();
    return tb - ta;
  });
}

/**
 * Compact dashboard preview — reuses existing conversation rows only (no duplicate chat state).
 */
export default function RecentChatsPreviewCard({
  mode = "customer",
  conversations = [],
  orders = [],
  messagesPath,
  glassCardClass = "",
}) {
  const navigate = useNavigate();

  const previewRows = useMemo(() => sortConversationsDesc(conversations).slice(0, 3), [conversations]);

  const resolveName = (conv) => {
    const oid = normalizeConversationId(conv?.orderId ?? conv?.conversationId ?? "");
    const order = orders.find((o) => String(o.id ?? o._id) === oid);
    if (mode === "tailor") {
      return (
        displayChatActorName(conv?.customerName, order?.customerName, conv?.customerId) || "Customer"
      );
    }
    return (
      displayChatActorName(
        conv?.tailorName,
        conv?.tailorShopName,
        order?.tailorName,
        order?.tailorShopName
      ) || "Tailor"
    );
  };

  const unreadFor = (conv) =>
    Math.max(0, Number(mode === "customer" ? conv?.unreadCustomer : conv?.unreadTailor) || 0);

  return (
    <section
      className={`flex min-h-0 w-full flex-col p-5 sm:p-6 ${glassCardClass}`.trim()}
      aria-label="Recent chats"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-50/90 text-emerald-800 shadow-sm"
            aria-hidden
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
          </span>
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Recent Chats</h2>
        </div>
      </div>

      <ul className="mt-4 min-h-0 flex-1 space-y-2">
        {previewRows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200/80 bg-white/30 px-3 py-6 text-center text-sm text-slate-500">
            No conversations yet.
          </li>
        ) : (
          previewRows.map((conv) => {
            const oid = normalizeConversationId(conv?.orderId ?? conv?.conversationId ?? "");
            const order = orders.find((o) => String(o.id ?? o._id) === oid);
            const name = resolveName(conv);
            const preview =
              (conv?.lastMessage && String(conv.lastMessage).trim()) || "Start conversation";
            const unread = unreadFor(conv);
            const badge = chatStatusBadge(conv, order);
            return (
              <li
                key={oid || `${name}-${conv?.lastMessageAt || "row"}`}
                className="flex items-center gap-3 rounded-xl border border-white/50 bg-white/40 px-3 py-2.5 transition-colors hover:bg-white/55"
              >
                <div className={avatarClassName("sm", "h-10 w-10 text-xs")} aria-hidden>
                  {chatInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{name}</p>
                    {unread > 0 ? (
                      <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : (
                      <span className={`shrink-0 ${badge.className}`}>{badge.label}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">{preview}</p>
                  {shortOrderId(oid) ? (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{shortOrderId(oid)}</p>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <button
        type="button"
        onClick={() => navigate(messagesPath)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/20 bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2"
      >
        Open Messages
      </button>
    </section>
  );
}
