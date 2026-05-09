import React, { useEffect, useRef, useState } from "react";
import { buildOutgoingChatMessage, normalizeChatId } from "./chatUtils";
import { ensureSocketThen, socket } from "./socket";

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function belongsToConversation(message, conversationId) {
  return normalizeChatId(message?.conversationId) === normalizeChatId(conversationId);
}

export default function CustomerChatWindow({ isOpen, onClose, customerId, tailorId, tailorName, conversationId }) {
  const senderId = normalizeChatId(customerId);
  const receiverId = normalizeChatId(tailorId);
  const convId = normalizeChatId(conversationId);
  const receiverName = tailorName;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const endOfMessagesRef = useRef(null);
  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = convId;
  }, [convId]);

  useEffect(() => {
    const handleChatHistory = (payload) => {
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      const activeConversationId = activeConversationRef.current;
      if (!activeConversationId) {
        setMessages([]);
        return;
      }
      setMessages(history.filter((message) => belongsToConversation(message, activeConversationId)));
    };

    const handleMessageReceived = (message) => {
      const activeConversationId = activeConversationRef.current;
      if (
        !normalizeChatId(message?.conversationId) ||
        !activeConversationId ||
        normalizeChatId(message.conversationId) !== activeConversationId
      ) {
        return;
      }

      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            (m.id && message.id && m.id === message.id) ||
            (belongsToConversation(m, activeConversationId) &&
              m.timestamp === message.timestamp &&
              m.content === message.content)
        );
        return exists ? prev : [...prev, message];
      });
    };

    socket.on("chat_history", handleChatHistory);
    socket.on("message_received", handleMessageReceived);

    return () => {
      socket.off("chat_history", handleChatHistory);
      socket.off("message_received", handleMessageReceived);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !convId || !senderId || !receiverId) return;

    const runJoin = () => {
      activeConversationRef.current = convId;
      socket.emit("join_user", { userId: senderId });
      socket.emit("join_conversation", { conversationId: convId });
      setMessages([]);
      socket.emit("request_history", { conversationId: convId });
    };

    ensureSocketThen(runJoin);
  }, [convId, isOpen, receiverId, senderId]);

  useEffect(() => {
    if (!isOpen) return;
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;
    if (!convId || !senderId || !receiverId) return;

    const newMessage = buildOutgoingChatMessage({
      senderId,
      receiverId,
      conversationId: convId,
      content,
      status: "sent",
    });
    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    ensureSocketThen(() => {
      socket.emit("send_message", newMessage);
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-6 backdrop-blur-[3px] transition-opacity duration-200 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/40 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.2)] ring-1 ring-white/30"
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 100%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          backdropFilter: "blur(28px) saturate(180%)",
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 8px 32px -10px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div className="flex items-center justify-between border-b border-white/35 bg-gradient-to-r from-emerald-50/50 via-white/20 to-sky-50/30 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              Chat with {receiverName || "Tailor"}
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

        <div className="max-h-[55vh] min-h-[280px] space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/60 to-white/30 px-5 py-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((message) => {
              const isSent = normalizeChatId(message.senderId) === senderId;
              return (
                <div
                  key={message.id || `${message.timestamp}-${message.content}`}
                  className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isSent
                        ? "bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] text-white shadow-emerald-900/15"
                        : "border border-slate-200/90 bg-white/90 text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    }`}
                  >
                    <p>{message.content}</p>
                    <p className={`mt-1 text-[10px] ${isSent ? "text-white/85" : "text-slate-500"}`}>
                      {formatTime(message.timestamp)} · {message.status || "sent"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-white/35 bg-white/25 px-5 py-4 backdrop-blur-md">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message…"
            className="w-full rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2.5 text-sm text-slate-800 shadow-inner shadow-slate-900/5 placeholder:text-slate-400 focus:border-emerald-300/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="button"
            onClick={handleSend}
            className="shrink-0 rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 active:scale-[0.98]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
