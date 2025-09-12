/* eslint-disable max-len */
import {
  ArrowUp,
  AudioWaveform,
  Fullscreen,
  Mic,
  Minimize2,
  Pause,
  Play,
  Square,
  Video,
  Monitor,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  PipecatClientAudio,
  PipecatClientVideo,
  usePipecatClient,
  usePipecatClientTransportState,
  usePipecatClientMicControl,
  usePipecatClientCamControl,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";

import { ChatMessage } from "./MessageList";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "./prompt-kit/prompt-input";
import { Button } from "./shadcn/button";
import { Separator } from "./shadcn/seperator";
import { Tooltip, TooltipContent, TooltipTrigger } from "./shadcn/tooltip";

const ChatContainer3: React.FC = () => {
  const client = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const isConnected = ["connected", "ready"].includes(transportState);
  const { enableMic, isMicEnabled } = usePipecatClientMicControl();
  const { enableCam, isCamEnabled } = usePipecatClientCamControl();
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messages, _setMessages] = useState<ChatMessage[]>([]);
  const [paused, setPaused] = useState(false);
  // const [_videoQualityPreset, _setVideoQualityPreset] =
  //   useState<VideoQualityPreset>(defaultVideoQualityPreset);
  const [_showFileTools, _setShowFileTools] = useState<boolean>(false);
  const [_isMessagesVisible, _setIsMessagesVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFullInterface, setShowFullInterface] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Send text message to bot
  const handleSendMessage = useCallback(async (message: string) => {
    if (!client || !message.trim()) return;
    
    try {
      // Send message through WebRTC using RTVI protocol
      client.sendClientMessage('user-text-message', { 
        text: message.trim(), 
      });
      
      console.log("[MESSAGE] Sent to bot:", message.trim());
      setMessage(""); // Clear input after sending
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [client]);

  // Audio/Video toggle handlers
  const handleMicToggle = useCallback(() => {
    enableMic(!isMicEnabled);
  }, [enableMic, isMicEnabled]);

  const handleScreenShareToggle = useCallback(() => {
    if (!client) return;
    try {
      client.enableScreenShare(!isScreenSharing);
      setIsScreenSharing(!isScreenSharing);
    } catch (error) {
      console.error("Screen share error:", error);
    }
  }, [client, isScreenSharing]);

  const handleCameraToggle = useCallback(() => {
    enableCam(!isCamEnabled);
  }, [enableCam, isCamEnabled]);

  // Event handlers for Pipecat client
  useRTVIClientEvent(
    RTVIEvent.BotReady,
    useCallback(() => {
      console.log("Bot is ready to chat!");
      setIsLoading(false);
    }, []),
  );

  useRTVIClientEvent(
    RTVIEvent.Connected,
    useCallback(() => {
      console.log("User connected to Pipecat");
      setIsLoading(false);
    }, []),
  );

  useRTVIClientEvent(
    RTVIEvent.Disconnected,
    useCallback(() => {
      console.log("User disconnected from Pipecat");
      setIsLoading(false);
    }, []),
  );

  // Sync screen sharing state with client
  useEffect(() => {
    if (client) {
      const interval = setInterval(() => {
        setIsScreenSharing(client.isSharingScreen);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [client]);

  // ChatGPT-style drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({
    isMouseDown: false,
    startX: 0,
    startY: 0,
    hasMoved: false,
    threshold: 5, // Minimum pixels to move before considering it a drag
  });

  useEffect(() => {
    // Always use centered resize to maintain proper positioning
    if (!showFullInterface) {
      // Pill mode: 20px height, 70px width (centered)
      window.electronAPI.resizeWindowFromBottomCentered(20, 70);
    } else {
      // Full interface mode: fixed height with scrollable content
      let height = 105; // Base height: Input area + padding

      if (showContext) {
        height += 260; // Fixed height for context area with scroll
      }

      window.electronAPI.resizeWindowFromBottomCentered(height, 500);
    }
  }, [showFullInterface, showContext]);

  // ChatGPT-style drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest('[role="button"]')
    ) {
      return;
    }

    dragStateRef.current = {
      isMouseDown: true,
      startX: e.screenX,
      startY: e.screenY,
      hasMoved: false,
      threshold: 5,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStateRef.current.isMouseDown) return;

    const deltaX = e.screenX - dragStateRef.current.startX;
    const deltaY = e.screenY - dragStateRef.current.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (
      distance > dragStateRef.current.threshold &&
      !dragStateRef.current.hasMoved
    ) {
      // Start dragging
      dragStateRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragStateRef.current.hasMoved) {
      // Move the window
      window.electronAPI.moveWindow(deltaX, deltaY);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragStateRef.current.isMouseDown) {
      setIsDragging(false);
      dragStateRef.current.isMouseDown = false;
      // Don't reset hasMoved immediately - we need it to prevent onClick
      // Reset the initial window position for next drag
      window.electronAPI.resetDragPosition();
    }
  }, []);

  // Global mouse event listeners for drag functionality
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isMouseDown) return;

      const deltaX = e.screenX - dragStateRef.current.startX;
      const deltaY = e.screenY - dragStateRef.current.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (
        distance > dragStateRef.current.threshold &&
        !dragStateRef.current.hasMoved
      ) {
        dragStateRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragStateRef.current.hasMoved) {
        window.electronAPI.moveWindow(deltaX, deltaY);
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragStateRef.current.isMouseDown) {
        setIsDragging(false);
        dragStateRef.current.isMouseDown = false;
        // Don't reset hasMoved immediately - we need it to prevent onClick
        // Reset the initial window position for next drag
        window.electronAPI.resetDragPosition();
      }
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Smart click handler that prevents click if user has dragged
  const handlePillClick = useCallback((e: React.MouseEvent) => {
    // If the user has moved the mouse (dragged), prevent the click
    if (dragStateRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      // Reset hasMoved after preventing the click
      setTimeout(() => {
        dragStateRef.current.hasMoved = false;
      }, 0);
      return;
    }

    // Only expand if it was a genuine click (no drag)
    setShowFullInterface(true);
  }, []);

  const connected = isConnected;
  const displayConnected = false;
  return (
    <div
      className={`w-full h-full ${
        isDragging ? "cursor-grabbing" : "cursor-default"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {!showFullInterface ? (
        <div
          className="flex items-center justify-center gap-1 w-full h-full bg-gray-700 select-none"
          onClick={handlePillClick}
        >
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          <PromptInput
            value={message}
            onValueChange={(value) => setMessage(value)}
            isLoading={isLoading}
            onSubmit={() => handleSendMessage(message)}
            className="w-full max-w-(--breakpoint-md) rounded-md"
          >
            <div className="flex items-center gap-2 ml-2">
              <ConnectionIndicator
                connection={displayConnected ? "connected" : "disconnected"}
              />
              <PromptInputTextarea
                placeholder="Ask me anything..."
                className="!h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(message);
                  }
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-8"
                    onClick={() => setShowFullInterface(false)}
                  >
                    <Minimize2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Minimize window</TooltipContent>
              </Tooltip>

              <Button variant="secondary" size="icon" className="size-8">
                <Fullscreen />
              </Button>
              <Button
                variant="secondary"
                className={`${
                  connected
                    ? "bg-red-300 text-red-950"
                    : "bg-green-300 text-green-950"
                }`}
                onClick={async () => {
                  if (!client) return;

                  try {
                    if (connected) {
                      const disconnect = client.disconnect();
                      await disconnect;
                      enableMic(false);
                      enableCam(false);
                      setIsScreenSharing(false);
                    } else {
                      const connect = client.connect();
                      await connect;
                      enableMic(true);
                      // Enable screen sharing after connection is established
                      client.enableScreenShare(true);
                      setIsScreenSharing(true);
                    }
                  } catch (error) {
                    console.error("Connection error:", error);
                  }
                }}
              >
                {connected ? `End Session` : `Start Session`}
              </Button>
            </div>

            <Separator />
            <PromptInputActions className="flex items-center justify-between gap-2 pt-2 w-full">
              <PromptInputAction
                tooltip="Actions"
                className="justify-self-start"
              >
                <div className="bg-gray-100 rounded-md flex items-center justify-center gap-2 p-0.5">
                  <Button variant="ghost" className="size-8">
                    <AudioWaveform />
                  </Button>
                  <Button
                    variant="ghost"
                    className={`size-7 rounded-full ${
                      isMicEnabled
                        ? "bg-red-300 hover:bg-red-400 text-red-900"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={handleMicToggle}
                  >
                    <Mic />
                  </Button>
                  <Button
                    variant="ghost"
                    className={`size-7 rounded-full ${
                      isCamEnabled
                        ? "bg-red-300 hover:bg-red-400 text-red-900"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={handleCameraToggle}
                  >
                    <Video />
                  </Button>
                  <Button
                    variant="ghost"
                    className={`size-7 rounded-full ${
                      isScreenSharing
                        ? "bg-red-300 hover:bg-red-400 text-red-900"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={handleScreenShareToggle}
                  >
                    <Monitor />
                  </Button>
                  <div className="h-6 w-px bg-gray-400"></div>
                  <Button
                    variant="ghost"
                    className="size-8"
                    onClick={() => setPaused(!paused)}
                  >
                    {paused ? <Play /> : <Pause />}
                  </Button>
                </div>
              </PromptInputAction>
              <div className="flex items-center gap-2">
                <PromptInputAction
                  tooltip={showContext ? "Hide Context" : "Show Context"}
                >
                  <Button
                    variant="secondary"
                    onClick={() => setShowContext(!showContext)}
                  >
                    {showContext ? "Hide Context" : "Show Context"}
                  </Button>
                </PromptInputAction>
                <PromptInputAction
                  tooltip={isLoading ? "Stop generation" : "Send message"}
                >
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleSendMessage(message)}
                  >
                    {isLoading ? (
                      <Square className="size-5 fill-current" />
                    ) : (
                      <ArrowUp className="size-5" />
                    )}
                  </Button>
                </PromptInputAction>
              </div>
            </PromptInputActions>
          </PromptInput>

          {/* Chat Messages Display */}
          {showContext && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md max-h-60 overflow-y-auto">
              <h3 className="text-sm font-semibold mb-2">Chat Messages</h3>
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No messages yet. Start a session to begin chatting.
                </p>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded text-sm ${
                        msg.isUser
                          ? "bg-blue-100 text-blue-900 ml-4"
                          : "bg-green-100 text-green-900 mr-4"
                      }`}
                    >
                      <div className="font-semibold">
                        {msg.isUser ? "You" : "Bot"}
                      </div>
                      <div>{msg.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pipecat Audio Component - handles audio input/output */}
          <PipecatClientAudio />

          {/* Hidden Video Component - captures video but doesn't display */}
          <div style={{ display: "none" }}>
            <PipecatClientVideo participant="local" />
          </div>
        </div>
      )}
    </div>
  );
};

const ConnectionIndicator = ({
  connection,
}: {
  connection: "connected" | "connecting" | "disconnected";
}) => {
  return (
    <span className="relative flex size-3">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
          connection === "connected"
            ? "bg-green-400"
            : connection === "connecting"
              ? "bg-yellow-400"
              : "bg-red-400"
        } opacity-75`}
      ></span>
      <span
        className={`relative inline-flex size-3 rounded-full ${
          connection === "connected"
            ? "bg-green-400"
            : connection === "connecting"
              ? "bg-yellow-400"
              : "bg-red-400"
        }`}
      ></span>
    </span>
  );
};

export default ChatContainer3;
