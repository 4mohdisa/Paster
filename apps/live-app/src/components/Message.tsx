import React from 'react';

interface MessageProps {
  message: string;
  isUser: boolean;
  timestamp?: Date;
}

const Message: React.FC<MessageProps> = ({ message, isUser, timestamp }) => {
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-2xl px-4 py-2 rounded-2xl shadow-sm ${
          isUser
            ? 'bg-neutral-800 text-white rounded-br-sm'
            : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-sm'
        }`}
      >
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message}
        </div>
        {timestamp && (
          <div className={`text-xs mt-1 ${isUser ? 'text-neutral-300' : 'text-neutral-500'}`}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
