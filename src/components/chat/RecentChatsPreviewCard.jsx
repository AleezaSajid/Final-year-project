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
import { TD_CHATS_OPEN_BTN } from "../../tailorDashboard/tailorDashboardClassNames.js";

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
  const isTailor = mode === "tailor";

  const previewRows = useMemo(() => sortConversationsDesc(conversations).slice(0, 2), [conversations]);

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

  const defaultCardClass =
    "rounded-2xl border border-slate-200/80 bg-white/45 p-4 shadow-lg backdrop-blur-xl";

  const cardClass = [glassCardClass || defaultCardClass].filter(Boolean).join(" ");

  return (
    <section
      className={`flex w-full flex-col ${cardClass}`.trim()}
      aria-label="Recent chats"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={
              isTailor
                ? "flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(140,170,160,0.22)] bg-[rgba(237,247,243,0.85)] text-[#2f6f56] shadow-sm"
                : "flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/60 bg-emerald-50/90 text-emerald-800 shadow-sm"
            }
            aria-hidden
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
          </span>
          <h2
            className={
              isTailor
                ? "text-sm font-bold tracking-tight text-[#183b2d] sm:text-base"
                : "text-sm font-bold tracking-tight text-slate-900 sm:text-base"
            }
          >
            Recent Chats
          </h2>
        </div>
      </div>

      <ul
        className={
          isTailor
            ? "mt-3 max-h-[12.5rem] shrink-0 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
            : "mt-3.5 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain"
        }
      >
        {previewRows.length === 0 ? (
          <li
            className={
              isTailor
                ? "rounded-2xl border border-dashed border-[rgba(140,170,160,0.22)] bg-[rgba(248,250,249,0.7)] px-3 py-3.5 text-center text-xs text-[#5c7a6d]"
                : "rounded-xl border border-dashed border-slate-200/80 bg-white/30 px-3 py-6 text-center text-sm text-slate-500"
            }
          >
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
                className={
                  isTailor
                    ? "flex items-center gap-3 rounded-2xl border border-[rgba(140,170,160,0.16)] bg-[rgba(255,255,255,0.55)] px-3 py-2.5 transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-[rgba(46,125,90,0.2)] hover:bg-[rgba(255,255,255,0.82)] hover:shadow-[0_8px_22px_-12px_rgba(15,23,42,0.08)]"
                    : "flex items-center gap-3 rounded-xl border border-white/50 bg-white/40 px-3 py-2.5 transition-colors hover:bg-white/55"
                }
              >
                <div className={avatarClassName("sm", "h-10 w-10 text-xs")} aria-hidden>
                  {chatInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-sm font-bold ${isTailor ? "text-[#183b2d]" : "text-slate-900"}`}
                    >
                      {name}
                    </p>
                    {unread > 0 ? (
                      <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : (
                      <span className={`shrink-0 ${badge.className}`}>{badge.label}</span>
                    )}
                  </div>
                  <p
                    className={`mt-0.5 truncate text-[13px] ${isTailor ? "text-[#5c7a6d]" : "text-slate-500"}`}
                  >
                    {preview}
                  </p>
                  {shortOrderId(oid) ? (
                    <p
                      className={`mt-0.5 truncate font-mono text-[10px] ${isTailor ? "text-[#8aa399]" : "text-slate-400"}`}
                    >
                      {shortOrderId(oid)}
                    </p>
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
        className={
          isTailor
            ? `mt-2.5 shrink-0 inline-flex w-full items-center justify-center gap-2 ${TD_CHATS_OPEN_BTN}`
            : "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/20 bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2"
        }
      >
        Open Messages
      </button>
    </section>
  );
}
