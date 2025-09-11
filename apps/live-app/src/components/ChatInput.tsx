import React, { useState, KeyboardEvent } from "react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  onAudioClick?: () => void;
  onVideoClick?: () => void;
  isAudioRecording?: boolean;
  isScreenRecording?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  onAudioClick,
  onVideoClick,
  isAudioRecording,
  isScreenRecording,
}) => {
  const [message, setMessage] = useState("");
  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Audio Button */}
        <button
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
            isAudioRecording
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
          }`}
          disabled={disabled}
          title={isAudioRecording ? 'Stop microphone' : 'Start microphone'}
          onClick={onAudioClick}
        >
          {isAudioRecording && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 1a3 3 0 00-3 3v6a3 3 0 106 0V4a3 3 0 00-3-3zm-7 10a7 7 0 0014 0m-7 7v4m0 0H8m4 0h4"
            />
          </svg>
        </button>

        {/* Video Button */}
        <button
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
            isScreenRecording
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
          }`}
          disabled={disabled}
          title={isScreenRecording ? 'Stop screen share' : 'Start screen share'}
          onClick={onVideoClick}
        >
          {isScreenRecording && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Text Input */}
        <div className="flex-1">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={disabled}
            className="w-full h-10 px-4 rounded-full border border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:cursor-not-allowed"
          title="Send message"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
