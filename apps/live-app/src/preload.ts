// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

import type { ElectronAPI, PageData } from "./types/electron-api";

//  This is just dummy data, This gives you type safety when you access window.electronAPI
//  Add fields in ./types/electron-api
const electronAPI: ElectronAPI = {
  getApiKey: () => {
    return new Promise((resolve) => {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
      resolve(key);
    });
  },

  // File Processing Service
  getParentStatus: () => ipcRenderer.invoke("fp-getParentStatus"),

  getActiveTab: () => ipcRenderer.invoke("fp-getActiveTab"),
  getFilesInContext: () => ipcRenderer.invoke("fp-getFilesInContext"),
  processTabData: (pageData: PageData) => ipcRenderer.invoke("fp-processTabData", pageData),

  // Main -> client message
  sendMessageToClient: (callback: (message: string) => void) =>
    ipcRenderer.on("sendMessageToClient", (_event, value) => callback(value)),
  // saving chunk locally
  saveAudioChunkLocally: (data: string, timestamp?: number) =>
    ipcRenderer.invoke("saveAudioChunkLocally", data, timestamp),
  stitchAudioChunks: () => ipcRenderer.invoke("fp-stitchAudio"),
  stitchVideoFrames: () => ipcRenderer.invoke("fp-stitchVideo"),
  saveVideoFrameLocally: (data: string, timestamp?: number) =>
    ipcRenderer.invoke("saveVideoFrameLocally", data, timestamp),
  mergeAudioAndVideo: () => ipcRenderer.invoke("fp-mergeAudioAndVideo"),
  // ... inside electronAPI
  saveLlmAudioChunkLocally: (data: string) => ipcRenderer.invoke("saveLlmAudioChunkLocally", data),
  stitchLlmAudioChunks: () => ipcRenderer.invoke("fp-stitchLlmAudio"),
  createDataVariants: () => ipcRenderer.invoke("fp-createDataVariants"),

  // Hotkeys (simple toggle)
  onAudioHotkey: (callback) => {
    const listener = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on("hotkey-audio", listener);
    return () => ipcRenderer.removeListener("hotkey-audio", listener);
  },
  onVideoHotkey: (callback) => {
    const listener = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on("hotkey-video", listener);
    return () => ipcRenderer.removeListener("hotkey-video", listener);
  },

  // Interface mode toggle
  onToggleInterfaceMode: (callback: () => void) => {
    const listener = (_event: any) => callback();
    ipcRenderer.on("toggle-interface-mode", listener);
    return () => ipcRenderer.removeListener("toggle-interface-mode", listener);
  },

  // Custom hotkey (Cmd+Shift+N)
  onCustomHotkey: (callback: () => void) => {
    const listener = (_event: any) => callback();
    ipcRenderer.on("custom-hotkey-pressed", listener);
    return () => ipcRenderer.removeListener("custom-hotkey-pressed", listener);
  },

  // Turn off all media hotkey (Cmd+Shift+M)
  onTurnOffAllMedia: (callback: () => void) => {
    const listener = (_event: any) => callback();
    ipcRenderer.on("hotkey-turn-off-all-media", listener);
    return () => ipcRenderer.removeListener("hotkey-turn-off-all-media", listener);
  },

  // Window utilities
  // resizeWindow: (height: number) => ipcRenderer.send("resize-window", height),
  resizeWindowFromBottom: (height: number, width: number) => 
    ipcRenderer.send("resize-window-from-bottom", height, width),
  resizeWindowFromBottomCentered: (height: number, width: number) => 
    ipcRenderer.send("resize-window-from-bottom-centered", height, width),
  getWindowBounds: () => ipcRenderer.invoke("get-window-bounds"),
  moveWindow: (deltaX: number, deltaY: number) => ipcRenderer.send("move-window", deltaX, deltaY),
  resetDragPosition: () => ipcRenderer.send("reset-drag-position"),
  
  // Pause state communication
  setPauseState: (paused: boolean) => ipcRenderer.send("set-pause-state", paused),
  
  // LLM connection state communication
  setLlmConnectionState: (connected: boolean) => ipcRenderer.send("set-llm-connection-state", connected),
  
  // File status notifications
  onStatusFileUpdated: (callback: () => void) => {
    const listener = (_event: any) => callback();
    ipcRenderer.on("status-file-updated", listener);
    return () => ipcRenderer.removeListener("status-file-updated", listener);
  },
  onFileAddedToContext: (callback: (data: { fileId: string; fileName: string; auto: boolean }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("file-added-to-context", listener);
    return () => ipcRenderer.removeListener("file-added-to-context", listener);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
