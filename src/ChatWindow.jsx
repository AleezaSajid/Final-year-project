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

export default function ChatWindow({ isOpen, onClose, senderId, receiverId, receiverName, conversationId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const endOfMessagesRef = useRef(null);
  const activeConversationRef = useRef(conversationId);

  useEffect(() => {
    activeConversationRef.current = conversationId;
    console.log("[TailorChat] conversationId:", conversationId);
  }, [conversationId]);

  useEffect(() => {
    console.log("[TailorChat] isOpen:", isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleChatHistory = (payload) => {
      const history = Array.isArray(payload?.messages) ? payload.messages : [];
      const activeConversationId = activeConversationRef.current;
      setMessages(history.filter((message) => belongsToConversation(message, activeConversationId)));
    };

    const handleMessageReceived = (message) => {
      const activeConversationId = activeConversationRef.current;
      console.log("[TailorChat] MESSAGE RECEIVED", message);
      const handleMessageReceived = (message) => {
        console.log("[TailorChat] RECEIVED:", message);
      
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === message.id);
          return exists ? prev : [...prev, message];
        });
      };
      console.log("[TailorChat] CONVERSATION ID CHECK PASSED", activeConversationId);
      console.log("[TailorChat] message_received:", message);
      setMessages((prev) => {
        const exists = prev.some(
          (msg) =>
            msg.senderId === message.senderId &&
            msg.receiverId === message.receiverId &&
            msg.timestamp === message.timestamp &&
            msg.content === message.content
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
    console.log("[TailorChat] join_conversation:", conversationId);
    setMessages([]);
    console.log("[TailorChat] request_history:", conversationId);
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
    console.log("[TailorChat] send_message:", newMessage);
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
      <div className="w-full max-w-xl rounded-2xl border border-orange-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-orange-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">Chat with {receiverName || "Customer"}</h3>
            <p className="text-xs text-gray-500">{socket.connected ? "Online" : "Connecting..."}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-sm text-[#6B7280] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
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
                      isSent ? "bg-orange-600 text-white" : "bg-white text-[#111827] border border-orange-200"
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

        <div className="flex items-center gap-2 border-t border-orange-200 px-5 py-4">
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
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 transition"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-orange-500 hover:scale-[1.02] active:scale-[0.98]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
