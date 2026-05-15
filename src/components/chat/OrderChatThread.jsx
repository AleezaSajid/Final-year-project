import React, { useEffect, useRef, useState } from "react";
import {
  buildOutgoingChatMessage,
  messageBelongsToOrderChat,
  normalizeChatId,
  normalizeConversationId,
} from "../../chatUtils.js";
import { ensureSocketThen, socket } from "../../socket.js";
import { notifyConversationRoomJoined, notifyConversationRoomLeft } from "../../conversationJoinRegistry.js";
import { Image as ImageIcon, Paperclip, Smile, Send } from "lucide-react";

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function belongsToConversation(message, conversationId) {
  return messageBelongsToOrderChat(message, conversationId);
}

/**
 * Core order chat UI + socket behavior (same as ChatWindow / CustomerChatWindow).
 * @param {'tailor'|'customer'} props.mode — customer path joins with customerId as sender
 */
export default function OrderChatThread({
  isActive,
  mode = "tailor",
  senderId,
  receiverId,
  peerDisplayName = "",
  conversationId,
  /** 'whatsapp' | 'glass' — glass matches legacy modal look */
  theme = "whatsapp",
  className = "",
  /** Optional top bar inside thread (WhatsApp layout supplies header outside) */
  showInnerHeader = false,
  innerHeaderTitle,
  innerHeaderSubtitle,
}) {
  const sId = normalizeChatId(senderId);
  const rId = normalizeChatId(receiverId);
  const cId = normalizeConversationId(conversationId);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const endOfMessagesRef = useRef(null);
  const activeConversationRef = useRef(conversationId);
  const lastJoinedConversationRef = useRef("");

  useEffect(() => {
    activeConversationRef.current = cId;
  }, [cId]);

  useEffect(() => {
    const prevJoined = normalizeConversationId(lastJoinedConversationRef.current);
    if (!isActive) {
      if (prevJoined) {
        notifyConversationRoomLeft(prevJoined);
        socket.emit("leave_conversation", { conversationId: prevJoined });
      }
      lastJoinedConversationRef.current = "";
      return;
    }
    if (!cId) return;
    if (prevJoined && prevJoined !== cId) {
      notifyConversationRoomLeft(prevJoined);
      socket.emit("leave_conversation", { conversationId: prevJoined });
    }
    lastJoinedConversationRef.current = cId;
  }, [isActive, cId]);

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
      if (!activeConversationId || !messageBelongsToOrderChat(message, activeConversationId)) {
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
    if (!isActive || !cId) return;
    if (mode === "customer" && (!sId || !rId)) return;
    const runJoin = () => {
      activeConversationRef.current = cId;
      if (sId) {
        socket.emit("join_user", { userId: sId });
      }
      notifyConversationRoomJoined(cId);
      socket.emit("join_conversation", { conversationId: cId });
      setMessages([]);
      socket.emit("request_history", { conversationId: cId });
    };
    ensureSocketThen(runJoin);
  }, [cId, isActive, sId, rId, mode]);

  useEffect(() => {
    if (!isActive) return;
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isActive, messages]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;
    if (!cId || !sId || !rId) return;

    const newMessage = buildOutgoingChatMessage({
      senderId: sId,
      receiverId: rId,
      conversationId: cId,
      content,
      status: "sent",
    });
    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    ensureSocketThen(() => {
      socket.emit("send_message", newMessage);
    });
  };

  const waBg = theme === "whatsapp" ? "bg-[#e5ddd5]" : "bg-gradient-to-b from-slate-50/60 to-white/30";
  const bubbleSent =
    theme === "whatsapp"
      ? "rounded-lg rounded-br-sm bg-[#dcf8c6] text-slate-900 shadow-sm"
      : "rounded-2xl bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] text-white shadow-emerald-900/15";
  const bubbleRecv =
    theme === "whatsapp"
      ? "rounded-lg rounded-bl-sm bg-white text-slate-900 shadow-sm"
      : "border border-slate-200/90 bg-white/90 text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      {showInnerHeader ? (
        <div className="shrink-0 border-b border-white/35 bg-gradient-to-r from-emerald-50/50 via-white/20 to-sky-50/30 px-5 py-3">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{innerHeaderTitle}</h3>
          {innerHeaderSubtitle ? (
            <p className="text-xs font-medium text-emerald-700">{innerHeaderSubtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4 ${waBg}`}>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600/90">
            No messages yet. Say hello to {peerDisplayName || "start the chat"}.
          </p>
        ) : (
          messages.map((message) => {
            const isSent = normalizeChatId(message.senderId) === sId;
            return (
              <div
                key={message.id || `${message.timestamp}-${message.content}`}
                className={`flex w-full ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(85%,28rem)] px-2.5 py-1.5 text-sm ${isSent ? bubbleSent : bubbleRecv}`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                  <p
                    className={`mt-0.5 text-right text-[10px] tabular-nums ${isSent ? "text-slate-600/90" : "text-slate-500"}`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div
        className={`shrink-0 border-t px-2 py-2 sm:px-3 ${
          theme === "whatsapp" ? "border-slate-200/80 bg-[#f0f2f5]" : "border-white/35 bg-white/25 px-5 py-4 backdrop-blur-md"
        }`}
      >
        {theme === "whatsapp" ? (
          <div className="flex items-end gap-1.5 rounded-xl border border-slate-200/90 bg-white px-1 py-1 shadow-inner shadow-slate-900/5 sm:gap-2">
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Emoji"
              disabled
            >
              <Smile className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Attach file"
              disabled
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Attach image"
              disabled
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message"
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={handleSend}
              className="shrink-0 rounded-xl bg-[#00a884] p-2.5 text-white shadow-sm transition hover:bg-[#008f6f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40"
              disabled={!cId || !sId || !rId}
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
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
        )}
      </div>
    </div>
  );
}
