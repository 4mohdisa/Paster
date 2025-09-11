// Import the shared ElectronAPI interface
import type { ElectronAPI } from "./electron-api";

// Extend the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
