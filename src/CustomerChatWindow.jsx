import React, { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function belongsToConversation(message, conversationId) {
  return message.conversationId === conversationId;
}

export default function CustomerChatWindow({ isOpen, onClose, customerId, tailorId, tailorName, conversationId }) {
  const senderId = customerId;
  const receiverId = tailorId;
  const receiverName = tailorName;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const endOfMessagesRef = useRef(null);
  const activeConversationRef = useRef(null);
  const senderRef = useRef(senderId);
  const receiverRef = useRef(receiverId);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    activeConversationRef.current = conversationId;
    console.log("[CustomerChat] conversationId:", conversationId);
  }, [conversationId]);
  useEffect(() => {
    if (!senderId) return;
  
    socket.emit("join_user", { userId: senderId });
    console.log("[CustomerChat] JOIN USER:", senderId);
  }, [senderId]);

  useEffect(() => {
    senderRef.current = senderId;
    receiverRef.current = receiverId;
  }, [receiverId, senderId]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    console.log("[CustomerChat] isOpen:", isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleChatHistory = (payload) => {
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      const activeConversationId = activeConversationRef.current;
      if (activeConversationId) {
        setMessages(history.filter((message) => belongsToConversation(message, activeConversationId)));
        return;
      }
      // Fallback for timing edge-case when conversationId ref updates slightly late.
      setMessages(
        history.filter((message) => {
          const isOutgoing = message.senderId === senderRef.current && message.receiverId === receiverRef.current;
          const isIncoming = message.senderId === receiverRef.current && message.receiverId === senderRef.current;
          return isOutgoing || isIncoming;
        })
      );
    };

    
    const handleMessageReceived = (message) => {
      const activeConversationId = activeConversationRef.current;
    
      console.log("[CustomerChat] RECEIVED:", message);
      console.log("[CustomerChat] ACTIVE CONVERSATION:", activeConversationId);
    
      const matchesConversation =
        Boolean(message?.conversationId) &&
        Boolean(activeConversationId) &&
        message.conversationId === activeConversationId;
      const matchesParticipants =
        (message?.senderId === senderRef.current && message?.receiverId === receiverRef.current) ||
        (message?.senderId === receiverRef.current && message?.receiverId === senderRef.current);

      if (!matchesConversation && !(isOpenRef.current && !activeConversationId && matchesParticipants)) {
        return;
      }

      if (!activeConversationId && message?.conversationId) {
        activeConversationRef.current = message.conversationId;
      }
    
      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            (m.id && message.id && m.id === message.id) ||
            (m.senderId === message.senderId &&
              m.receiverId === message.receiverId &&
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
    if (!isOpen || !conversationId) return;
    socket.emit("join_conversation", { conversationId });
    console.log("[CustomerChat] join_conversation:", conversationId);
    setMessages([]);
    console.log("[CustomerChat] request_history:", conversationId);
    socket.emit("request_history", { conversationId });
  }, [conversationId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;

    const newMessage = {
      senderId,
      receiverId,
      conversationId,
      content,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    console.log("[CustomerChat] send_message:", newMessage);
    setMessages((prev) => [...prev, newMessage]);
    socket.emit("send_message", newMessage);
    setInputValue("");
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 transition-opacity duration-200 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#E7EED0] bg-gradient-to-br from-[#F0F5E1] via-white to-[#FFF8E1] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E7EED0] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#2F3A20]">Chat with {receiverName || "Tailor"}</h3>
            <p className="text-xs text-gray-500">{socket.connected ? "Online" : "Connecting..."}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E7EED0] bg-white/80 px-3 py-1.5 text-sm text-[#4B5563] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            aria-label="Close chat"
          >
            Close
          </button>
        </div>

        <div className="max-h-[55vh] min-h-[280px] space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-gray-500">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((message) => {
              const isSent = message.senderId === senderId;
              return (
                <div key={message.id || `${message.timestamp}-${message.content}`} className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isSent ? "bg-[#636B2F] text-white" : "bg-white text-[#2F3A20] border border-[#E7EED0]"
                    }`}
                  >
                    <p>{message.content}</p>
                    <p className={`mt-1 text-[10px] ${isSent ? "text-white/80" : "text-gray-500"}`}>
                      {formatTime(message.timestamp)} - {message.status || "sent"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-[#E7EED0] px-5 py-4">
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
            placeholder="Type your message..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-[#BAC095] focus:border-[#636B2F] transition"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-lg bg-[#636B2F] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
