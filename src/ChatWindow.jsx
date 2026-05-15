import React from "react";
import { normalizeChatId, normalizeConversationId } from "./chatUtils";
import { socket } from "./socket";
import OrderChatThread from "./components/chat/OrderChatThread.jsx";

export default function ChatWindow({ isOpen, onClose, senderId, receiverId, receiverName, conversationId }) {
  const sId = normalizeChatId(senderId);
  const rId = normalizeChatId(receiverId);
  const cId = normalizeConversationId(conversationId);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-6 backdrop-blur-[3px] transition-opacity duration-200 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className="flex h-[min(90vh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/40 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.2)] ring-1 ring-white/30"
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 100%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          backdropFilter: "blur(28px) saturate(180%)",
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 8px 32px -10px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/35 bg-gradient-to-r from-emerald-50/50 via-white/20 to-sky-50/30 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              Chat with {receiverName || "Customer"}
            </h3>
            <p
              className={`text-xs font-medium ${socket.connected ? "text-emerald-700" : "text-amber-700/90"}`}
            >
              {socket.connected ? "Online" : "Connecting…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/50 bg-white/45 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            aria-label="Close chat"
          >
            Close
          </button>
        </div>
        <OrderChatThread
          isActive={isOpen && Boolean(cId && sId && rId)}
          mode="tailor"
          senderId={sId}
          receiverId={rId}
          peerDisplayName={receiverName || "Customer"}
          conversationId={cId}
          theme="glass"
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
