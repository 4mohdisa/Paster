import React, { useEffect, useRef } from "react";

import Message from "./Message";

export interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

interface MessageListProps {
  messages: ChatMessage[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center text-neutral-500">
              <div className="text-lg font-semibold mb-1">Start a conversation</div>
              <div className="text-sm">Send a message to begin chatting with the LLM</div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <Message
              key={index}
              message={msg.message}
              isUser={msg.isUser}
              timestamp={msg.timestamp}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
