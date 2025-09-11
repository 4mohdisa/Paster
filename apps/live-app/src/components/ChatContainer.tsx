import React, { useEffect, useRef, useState } from "react";
import { LiveServerToolCall } from "@google/genai";

import { useLiveAPIContext } from "../gemin/LiveAPIContext";
import { AudioRecorder } from "../services/recorder";
import { ScreenManager } from "../services/screen";
import { toolList } from "../gemin/gemini-tools";
import {
  captureInterval,
  quality,
  resizeWidth,
  videoQualityPresets,
  defaultVideoQualityPreset,
  VideoQualityPreset,
} from "../constants/screen-recorder";

import MessageList, { ChatMessage } from "./MessageList";
import ChatInput from "./ChatInput";
import { FileTools } from "./FileTools";

const recorder = new AudioRecorder();

let screenInterval: NodeJS.Timeout = null;

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

const ChatContainer: React.FC = () => {
  const { client, connected, connect, disconnect } = useLiveAPIContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [videoQualityPreset, setVideoQualityPreset] =
    useState<VideoQualityPreset>(defaultVideoQualityPreset);
  const [showFileTools, setShowFileTools] = useState<boolean>(false);
  const [isActionsOpen, setIsActionsOpen] = useState<boolean>(false);

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

  useEffect(() => {
    // Main window manages the live connection.
    connect();

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

    return () => {
      unsubscribeAudio?.();
      unsubscribeVideo?.();
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
          const result = await tool.functionExecutions(fc.args);
          console.log("result", result);
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
  }, [client]);

  async function finishRecording() {
    console.log("Stitching audio chunks...");

    await Promise.all([
      window.electronAPI.stitchAudioChunks(),
      window.electronAPI.stitchVideoFrames(),
      window.electronAPI.stitchLlmAudioChunks(),
    ]).then(() => {
      console.log("All done! Check your media'.");
    });

    console.log("All done! Check your media folder for 'final-movie.mp4'.");
  }

  const handleRecordingAudio = async () => {
    if (recorder.isRecording) {
      recorder.stop();
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
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString() + "-user",
      message: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    client.send([{ text: messageText }]);
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
    <div className="flex flex-col h-full w-full bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Status and indicators */}
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium border ${
                displayConnected
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-neutral-100 text-neutral-700 border-neutral-200"
              }`}
              title={displayConnected ? "Connected" : "Disconnected"}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  displayConnected ? "bg-green-500" : "bg-neutral-400"
                }`}
              />
              {displayConnected ? "Connected" : "Disconnected"}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-600">Video quality</label>
              <select
                className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white"
                value={videoQualityPreset}
                onChange={(e) => {
                  const preset = e.target.value as VideoQualityPreset;
                  setVideoQualityPreset(preset);
                  const cfg = videoQualityPresets[preset];
                  screenManager.setQuality(cfg.width, cfg.quality);
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* File tools toggle */}
            <button
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
              onClick={() => setShowFileTools((v) => !v)}
              title={showFileTools ? "Hide file tools" : "Show file tools"}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7h18M3 12h18M3 17h18"
                />
              </svg>
              File tools
            </button>

            {/* Actions menu */}
            <div className="relative">
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white hover:bg-neutral-50"
                onClick={() => setIsActionsOpen((v) => !v)}
                title="More actions"
              >
                <svg
                  className="h-5 w-5 text-neutral-700"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 14a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                </svg>
              </button>
              {isActionsOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md border border-neutral-200 bg-white shadow-sm z-20">
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50"
                    onClick={async () => {
                      setIsActionsOpen(false);
                      console.log("Merging audio and video...");
                      await window.electronAPI.mergeAudioAndVideo();
                    }}
                  >
                    Merge Audio & Video
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setIsActionsOpen(false);
                      window.electronAPI.createDataVariants();
                    }}
                  >
                    Create Data Variants
                  </button>
                </div>
              )}
            </div>

            {/* Connect / Disconnect */}
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white ${
                connected
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-neutral-900 hover:bg-neutral-800"
              }`}
              onClick={() => {
                if (connected) {
                  disconnect();
                  finishRecording();
                } else {
                  connect();
                }
              }}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-red-300" : "bg-green-400"
                }`}
              />
              {connected ? "Stop connection" : "Start connection"}
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0">
        <MessageList messages={messages} />
      </div>

      {/* --- FILE TOOLS UI --- */}
      {showFileTools ? (
        <FileTools />
      ) : (
        <div className="border-t border-neutral-200 bg-white px-4 py-2 text-center">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            onClick={() => setShowFileTools(true)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7h18M3 12h18M3 17h18"
              />
            </svg>
            Show file tools
          </button>
        </div>
      )}
      {/* ------------------- */}

      {/* Input Area */}
      <div className="bg-white">
        <ChatInput
          onSendMessage={(text) => handleSendMessage(text)}
          disabled={false}
          onAudioClick={() => handleRecordingAudio()}
          isAudioRecording={isAudioRecording}
          onVideoClick={() => handleScreenRecording()}
          isScreenRecording={isScreenRecording}
        />
      </div>
    </div>
  );
};

export default ChatContainer;
