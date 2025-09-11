/* eslint-disable max-len */
import { LiveServerToolCall } from "@google/genai";
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
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";

import {
  captureInterval,
  quality,
  resizeWidth,
  defaultVideoQualityPreset,
  VideoQualityPreset,
} from "../constants/screen-recorder";
import { toolList } from "../gemin/gemini-tools";
import { useLiveAPIContext } from "../gemin/LiveAPIContext";
import { AudioRecorder } from "../services/recorder";
import { ScreenManager } from "../services/screen";
import { FileProcessingStatus } from "../types/electron-api";

import FilePills from "./FilePills";
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

const recorder = new AudioRecorder();

let screenInterval: NodeJS.Timeout | null = null;

const screenManager = new ScreenManager({
  width: resizeWidth,
  quality: quality,
  onStop: () => {
    // Clean up interval and emit event when screen sharing stops
    if (screenInterval) {
      clearInterval(screenInterval);
      screenInterval = null;
    }
  },
});

const ChatContainer2: React.FC = () => {
  const { client, connected, connect, disconnect, paused, setPaused } =
    useLiveAPIContext();
  const [message, setMessage] = useState<string>("");
  const [_messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [_videoQualityPreset, _setVideoQualityPreset] =
    useState<VideoQualityPreset>(defaultVideoQualityPreset);
  const [_showFileTools, _setShowFileTools] = useState<boolean>(false);
  const [_isMessagesVisible, _setIsMessagesVisible] = useState<boolean>(false);
  const [isLoading, _setIsLoading] = useState(false);
  const [showFullInterface, setShowFullInterface] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // File management state
  const [availableFiles, setAvailableFiles] = useState<FileProcessingStatus[]>(
    [],
  );
  const [contentInContext, setContentInContext] = useState<Set<string>>(new Set()); // "fileId-contentType" combinations

  // Fetch available files from status
  const fetchAvailableFiles = useCallback(async () => {
    try {
      const result = await window.electronAPI.getParentStatus();
      if (result && result.files) {
        const filesList = Object.values(result.files);
        setAvailableFiles(filesList);
      }
    } catch (error) {
      console.error("Error fetching available files:", error);
    }
  }, []);

  // Add content variant to context (send specific content to LLM)
  const handleAddContentToContext = useCallback(
    async (fileId: string, fileName: string, contentType: string) => {
      const contentKey = `${fileId}-${contentType}`;
      
      if (contentInContext.has(contentKey)) {
        return; // Already in context
      }
      
      try {
        // Get the specific content variant
        const contentResult = await window.electronAPI.getFileContent(
          { fileId },
          contentType,
        );

        if (typeof contentResult === "string") {
          // Get display name for content type
          const getContentTypeDisplayName = (type: string): string => {
            const displayNames: { [key: string]: string } = {
              'summary': 'Summary',
              'text': 'Text',
              'description': 'Description',
              'transcript': 'Transcript',
              'transcript_with_timestamps': 'Transcript + Times',
              'detailed_description': 'Detailed Desc',
              'formatted_text': 'Formatted Text',
            };
            return displayNames[type] || type;
          };

          const displayName = getContentTypeDisplayName(contentType);
          
          // Send content to LLM with context information (client handles connection checks)
          const contextMessage = `File "${fileName}" (${displayName}) has been added to context:\n\n${contentResult}`;
          client.send([{ text: contextMessage }]);

          // Only add to local context state if not paused and connected
          if (!paused && connected) {
            setContentInContext((prev) => new Set([...prev, contentKey]));
          }

          // Send notification to chat
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              message: `SYSTEM: Added "${fileName}" (${displayName}) to context`,
              isUser: false,
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error) {
        console.error("Error adding content to context:", error);
      }
    },
    [client, setMessages, paused, connected, contentInContext],
  );

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
  }, [
    showFullInterface,
    showContext,
  ]);

  // Keep stable references to the latest toggle handlers to avoid stale closures
  const audioToggleRef = useRef<() => void>(() => {
    //
  });
  const videoToggleRef = useRef<() => void>(() => {
    //
  });
  useEffect(() => {
    audioToggleRef.current = handleRecordingAudio;
    videoToggleRef.current = handleScreenRecording;
  });

  // Sync pause state with the client
  useEffect(() => {
    client.setPaused(paused);
  }, [paused, client]);

  // Communicate pause state to main process
  useEffect(() => {
    window.electronAPI.setPauseState(paused);
  }, [paused]);

  // Communicate connection state to main process
  useEffect(() => {
    window.electronAPI.setLlmConnectionState(connected);
  }, [connected]);

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

  function startNewSession() {
    if (!connected) connect();
    if (!isAudioRecording) handleRecordingAudio();
    if (!isScreenRecording) handleScreenRecording();
    if (paused) setPaused(false);
    setShowFullInterface(true);
  }

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

  // File status management effects
  useEffect(() => {
    // Initial load of available files
    fetchAvailableFiles();

    // Listen for status file updates
    const unsubscribeStatusUpdates = window.electronAPI.onStatusFileUpdated(
      () => {
        console.log("Status file updated, refreshing available files");
        fetchAvailableFiles();
      },
    );

    // Listen for files being auto-added to context
    const unsubscribeAutoContext = window.electronAPI.onFileAddedToContext(
      (data) => {
        console.log("File auto-added to context:", data);
        if (data.auto && !paused && connected) {
          // Auto-add summary content variant to context
          handleAddContentToContext(data.fileId, data.fileName, "summary");
        }
      },
    );

    return () => {
      unsubscribeStatusUpdates?.();
      unsubscribeAutoContext?.();
    };
  }, [fetchAvailableFiles, handleAddContentToContext, paused, connected]);

  useEffect(() => {
    // Main window manages the live connection.
    // connect();

    window.electronAPI.sendMessageToClient((message) => {
      console.log("message", message);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          message: message,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    });

    // Listen to hotkey events and toggle using existing handlers
    const unsubscribeAudio = window.electronAPI.onAudioHotkey(({ action }) => {
      if (action === "toggle") {
        console.log(`[TEST] Audio hotkey: toggle`);
        audioToggleRef.current();
      }
    });

    const unsubscribeVideo = window.electronAPI.onVideoHotkey(({ action }) => {
      if (action === "toggle") {
        console.log(`[TEST] Video hotkey: toggle`);
        videoToggleRef.current();
      }
    });

    // Listen for interface mode toggle from main process (for tray clicks)
    const unsubscribeToggle = window.electronAPI.onToggleInterfaceMode(() => {
      console.log("Interface mode toggle received from main process");
      setShowFullInterface((prev) => !prev);
    });

    // Listen for custom hotkey (Cmd+Shift+N)
    const unsubscribeToggleSessionHotkey = window.electronAPI.onCustomHotkey(
      () => {
        console.log("Custom hotkey (Cmd+Shift+N) was pressed");
        startNewSession();
      },
    );

    // Listen for secondary custom hotkey (Cmd+Shift+M)
    const unsubscribeSecondaryCustomHotkey =
      window.electronAPI.onSecondaryCustomHotkey(() => {
        console.log("Secondary custom hotkey (Cmd+Shift+M) was pressed");
        setPaused(!paused);
      });

    return () => {
      unsubscribeAudio?.();
      unsubscribeVideo?.();
      unsubscribeToggle?.();
      unsubscribeToggleSessionHotkey?.();
      unsubscribeSecondaryCustomHotkey?.();
      disconnect();
    };
  }, []);

  // TOOL CALLS
  useEffect(() => {
    const onToolCall = async (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      await Promise.all(
        toolCall.functionCalls.map(async (fc) => {
          console.log("fc", fc);
          const tool = toolList.find(
            (t) => t.functionDeclarations.name === fc.name,
          );
          if (!tool) {
            throw new Error(`Tool not found: ${fc.name}`);
          }
          const result = await tool.functionExecutions(fc.args);
          console.log("result", result);
          
          // AUTO-UPDATE: If it's a getFileContent call, auto-add to context
          if (fc.name === 'getFileContent' && result.success && fc.args) {
            const args = fc.args as any;
            const fileId = args.fileId as string;
            const contentType = args.contentType as string;
            
            if (fileId && contentType) {
              const contentKey = `${fileId}-${contentType}`;
              
              if (!contentInContext.has(contentKey)) {
                // Find the file to get its name
                const file = availableFiles.find(f => f.fileId === fileId);
                if (file) {
                  const fileName = file.fileName + file.fileExtension;
                  
                  // Get display name for content type
                  const getContentTypeDisplayName = (type: string): string => {
                    const displayNames: { [key: string]: string } = {
                      'summary': 'Summary',
                      'text': 'Text',
                      'description': 'Description',
                      'transcript': 'Transcript',
                      'transcript_with_timestamps': 'Transcript + Times',
                      'detailed_description': 'Detailed Desc',
                      'formatted_text': 'Formatted Text',
                    };
                    return displayNames[type] || type;
                  };
                  
                  const displayName = getContentTypeDisplayName(contentType);
                  
                  // Only add to context state if not paused and connected
                  if (!paused && connected) {
                    setContentInContext(prev => new Set([...prev, contentKey]));
                    
                    // Add system message
                    setMessages(prev => [
                      ...prev,
                      {
                        id: Date.now().toString(),
                        message: `SYSTEM: "${fileName}" (${displayName}) automatically added to context via tool call`,
                        isUser: false,
                        timestamp: new Date(),
                      },
                    ]);
                  }
                }
              }
            }
          }
          
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: true, result: result } },
                id: fc.id,
                name: fc.name,
              },
            ],
          });
          return result;
        }),
      );
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, contentInContext, availableFiles, setMessages, paused, connected]);

  async function finishRecording() {
    console.log("Starting coordinated media processing...");

    const processWithRetry = async (
      operation: () => Promise<void>,
      name: string,
      maxRetries = 1,
    ) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await operation();
          return { success: true, error: "" };
        } catch (error) {
          console.error(`${name} attempt ${attempt + 1} failed:`, error);
          if (attempt === maxRetries) {
            return { success: false, error: (error as any)?.message || "Unknown error" };
          }
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      return { success: false, error: "Max retries exceeded" };
    };

    const results = {
      audio: { success: false, error: "" },
      llmAudio: { success: false, error: "" },
      video: { success: false, error: "" },
      merge: { success: false, error: "" },
    };

    // Parallel processing with individual retry logic - these operations are independent
    const [audioResult, llmAudioResult, videoResult] = await Promise.all([
      processWithRetry(
        () => window.electronAPI.stitchAudioChunks(),
        "Audio stitching",
      ),
      processWithRetry(
        () => window.electronAPI.stitchLlmAudioChunks(),
        "LLM Audio stitching",
      ),
      processWithRetry(
        () => window.electronAPI.stitchVideoFrames(),
        "Video stitching",
      ),
    ]);

    results.audio = audioResult;
    results.llmAudio = llmAudioResult;
    results.video = videoResult;

    // Check if we have at least some media to work with
    const hasMedia =
      results.audio.success ||
      results.llmAudio.success ||
      results.video.success;

    if (!hasMedia) {
      const errorMsg =
        "All media processing failed. No final video will be created.";
      console.error(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          message: `SYSTEM NOTIFICATION: ${errorMsg}`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // Report individual failures
    const failures = [];
    if (!results.audio.success) failures.push(`Audio: ${results.audio.error}`);
    if (!results.llmAudio.success)
      failures.push(`LLM Audio: ${results.llmAudio.error}`);
    if (!results.video.success) failures.push(`Video: ${results.video.error}`);

    if (failures.length > 0) {
      const warningMsg = `Some media processing failed but continuing with available media:\n${failures.join(
        "\n",
      )}`;
      console.warn(warningMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          message: `SYSTEM NOTIFICATION: ${warningMsg}`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    }

    // Wait for filesystem sync
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Attempt merge with available media
    results.merge = await processWithRetry(
      () => window.electronAPI.mergeAudioAndVideo(),
      "Media merging",
    );

    if (!results.merge.success) {
      const errorMsg = `Final video merge failed: ${results.merge.error}`;
      console.error(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          message: `SYSTEM NOTIFICATION: ${errorMsg}`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } else {
      const successMsg =
        "Media processing completed successfully! Check your media folder for 'final-movie-complete.mp4'.";
      console.log(successMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          message: `SYSTEM NOTIFICATION: ${successMsg}`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);

      // Create data variants after successful merge
      try {
        console.log("Creating data variants for final merged video...");
        window.electronAPI.createDataVariants();
        console.log("Data variants creation completed");
      } catch (error) {
        console.error("Failed to create data variants:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            message: `SYSTEM NOTIFICATION: Data variants creation failed: ${
              (error as any)?.message || "Unknown error"
            }`,
            isUser: false,
            timestamp: new Date(),
          },
        ]);
      }
    }
  }

  const handleRecordingAudio = async () => {
    if (recorder.isRecording) {
      await recorder.stop();
      setIsAudioRecording(false);
    } else {
      setIsAudioRecording(true);
      recorder.start(async (audio: string, timestamp: number) => {
        client.sendRealtimeInput(
          [{ mimeType: "audio/pcm;rate=16000", data: audio }],
          timestamp,
        );
      });
    }
  };

  const handleSendMessage = (messageText: string) => {
    if (!messageText.trim()) return; // Don't send empty messages

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString() + "-user",
      message: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    client.send([{ text: messageText }]);
    setMessage(""); // Clear the input after sending
  };

  const handleScreenRecording = async () => {
    if (isScreenRecording) {
      if (screenInterval) {
        clearInterval(screenInterval);
        screenInterval = null;
      }
      screenManager.dispose();
      setIsScreenRecording(false);
    } else {
      try {
        await screenManager.initialize();

        // Set up interval to capture and send screenshots
        screenInterval = setInterval(async () => {
          const timestamp = Date.now();
          const imageBase64 = await screenManager.capture();
          client.sendRealtimeInput(
            [{ mimeType: "image/jpeg", data: imageBase64 }],
            timestamp,
          );
        }, captureInterval);

        console.info("Screen sharing started");
        setIsScreenRecording(true);
      } catch (error) {
        setIsScreenRecording(false);
        throw new Error("Failed to start screen sharing: " + error);
      }
    }
  };

  const displayConnected = connected;

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
                  await disconnect();
                  if (connected) {
                    finishRecording();
                  } else {
                    startNewSession();
                  }
                }}
              >
                {connected ? `End Session` : `Start Session`}
              </Button>
            </div>
            {showContext && (
              <FilePills
                files={availableFiles}
                contentInContext={contentInContext}
                onAddContentToContext={handleAddContentToContext}
              />
            )}
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
                      isAudioRecording
                        ? "bg-red-300 hover:bg-red-400 text-red-900"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={handleRecordingAudio}
                  >
                    <Mic />
                  </Button>
                  <Button
                    variant="ghost"
                    className={`size-7 rounded-full ${
                      isScreenRecording
                        ? "bg-red-300 hover:bg-red-400 text-red-900"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={handleScreenRecording}
                  >
                    <Video />
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

export default ChatContainer2;
