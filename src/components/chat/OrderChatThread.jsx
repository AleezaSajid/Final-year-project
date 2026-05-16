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
  import "./chatThread.css";

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  function dayKey(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  /** Display-only day label from message timestamp */
  function daySeparatorLabel(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const todayKey = dayKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const key = dayKey(d);
    if (key === todayKey) return "Today";
    if (key === dayKey(yesterday)) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }

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
    customerId: orderCustomerId,
    tailorId: orderTailorId,
    orderId,
    peerDisplayName = "",
    conversationId,
    /** 'whatsapp' | 'glass' — glass matches legacy modal look */
    theme = "whatsapp",
    className = "",
    /** Optional top bar inside thread (WhatsApp layout supplies header outside) */
    showInnerHeader = false,
    innerHeaderTitle,
    innerHeaderSubtitle,
    /** When true, show thread but block sending (e.g. until tailor accepts). */
    chatLocked = false,
    lockedMessage = "Chat will unlock after the tailor accepts this order.",
    /** Per-order unlock from order row (not global session). */
    isChatEnabled = true,
  }) {
    const sId = normalizeChatId(senderId);
    const rId = normalizeChatId(receiverId);
    const cId = normalizeConversationId(conversationId);
    const oId = normalizeConversationId(orderId) || cId;
    const locked = chatLocked || !isChatEnabled;
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
        if (socket.connected) {
          console.log("[chat] socket connected", socket.id);
        }
        if (sId) {
          console.log("[chat] joining room", sId);
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

    const inputDisabled = locked || !cId || !sId || !rId;

    const handleSend = () => {
      if (locked) return;
      const content = inputValue.trim();
      if (!content) return;
      if (!cId || !sId || !rId) return;

      console.log("[chat send computed]", {
        conversationId: cId,
        orderId: oId,
        senderId: sId,
        receiverId: rId,
        customerId: normalizeChatId(orderCustomerId),
        tailorId: normalizeChatId(orderTailorId),
        mode,
      });

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

    const waBg = theme === "whatsapp" ? "chat-wa-pattern" : "bg-gradient-to-b from-slate-50/60 to-white/30";
    const bubbleSent =
      theme === "whatsapp"
        ? "rounded-2xl rounded-br-md bg-[#d9fdd3] text-slate-900 shadow-[0_1px_1px_rgba(11,20,26,0.1)]"
        : "rounded-2xl rounded-br-md bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] text-white shadow-emerald-900/15";
    const bubbleRecv =
      theme === "whatsapp"
        ? "rounded-2xl rounded-bl-md bg-white text-slate-900 shadow-[0_1px_1px_rgba(11,20,26,0.1)]"
        : "rounded-2xl rounded-bl-md border border-slate-200/90 bg-white/90 text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";
    const emptyMessage = locked
      ? "Waiting for tailor acceptance."
      : "Chat unlocked. Start the conversation.";

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

        <div className={`chat-scroll-smooth min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-4 ${waBg}`}>
          <div className="mx-auto flex w-full max-w-2xl flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <p
                className={`max-w-xs text-sm leading-relaxed ${
                  locked ? "font-medium text-amber-900/90" : "font-normal text-slate-500"
                }`}
              >
                {emptyMessage}
              </p>
            </div>
          ) : (
            (() => {
              let lastDay = "";
              return messages.map((message, index) => {
                const isSent = normalizeChatId(message.senderId) === sId;
                const dk = dayKey(message.timestamp);
                const separatorLabel = dk && dk !== lastDay ? daySeparatorLabel(message.timestamp) : null;
                if (dk) lastDay = dk;
                const prev = messages[index - 1];
                const groupedWithPrev =
                  prev &&
                  dayKey(prev.timestamp) === dk &&
                  normalizeChatId(prev.senderId) === normalizeChatId(message.senderId);
                const rowGap = groupedWithPrev ? "mt-0.5" : "mt-2.5";
                return (
                  <React.Fragment key={message.id || `${message.timestamp}-${message.content}`}>
                    {separatorLabel ? (
                      <div className="chat-day-separator" role="separator">
                        <span>{separatorLabel}</span>
                      </div>
                    ) : null}
                    <div
                      className={`chat-message-enter flex w-full ${rowGap} ${
                        isSent ? "justify-end pl-6 sm:pl-10" : "justify-start pr-6 sm:pr-10"
                      }`}
                    >
                      <div
                        className={`max-w-[min(78%,22rem)] px-3 py-1.5 text-[15px] leading-snug ${isSent ? bubbleSent : bubbleRecv}`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <div
                          className={`mt-0.5 flex items-baseline justify-end gap-px ${
                            isSent ? "text-emerald-900/45" : "text-slate-400/90"
                          }`}
                        >
                          <span className="text-[10px] font-normal tabular-nums leading-none">
                            {formatTime(message.timestamp)}
                          </span>
                          {isSent ? (
                            <span
                              className="translate-y-px text-[8px] font-normal leading-none text-sky-500/35"
                              aria-hidden
                            >
                              ✓
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()
          )}
            <div ref={endOfMessagesRef} />
          </div>
        </div>

        <div
          className={`shrink-0 border-t px-2 py-2 sm:px-3 ${
            theme === "whatsapp" ? "border-slate-200/80 bg-[#f0f2f5]" : "border-white/35 bg-white/25 px-5 py-4 backdrop-blur-md"
          }`}
        >
          {locked ? (
            <div
              className="mb-2 flex items-start gap-2 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-amber-50/80 px-3.5 py-2.5 shadow-sm"
              role="status"
            >
              <span className="mt-0.5 text-amber-600" aria-hidden>
                ●
              </span>
              <p className="text-left text-xs font-medium leading-relaxed text-amber-950">{lockedMessage}</p>
            </div>
          ) : null}
          {theme === "whatsapp" ? (
            <div className="flex items-end gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-1.5 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.08)] sm:gap-2">
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
              <textarea
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={locked ? lockedMessage : "Type a message"}
                disabled={inputDisabled}
                className="min-w-0 flex-1 resize-none border-0 bg-transparent py-2.5 text-sm text-slate-800 placeholder:font-normal placeholder:text-slate-400/75 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSend}
                className="shrink-0 rounded-xl bg-[#00a884] p-2.5 text-white shadow-md transition duration-200 hover:bg-[#008f6f] hover:shadow-lg active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40"
                disabled={inputDisabled}
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <textarea
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={locked ? lockedMessage : "Type your message…"}
                disabled={inputDisabled}
                className="w-full resize-none rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2.5 text-sm text-slate-800 shadow-inner shadow-slate-900/5 placeholder:text-slate-400 focus:border-emerald-300/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={inputDisabled}
                className="shrink-0 rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#3d5d48] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 active:scale-[0.98] disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
