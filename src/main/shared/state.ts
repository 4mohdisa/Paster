import type { BrowserWindow } from "electron";
import { logInfo } from "../logger";
import type { StorageData } from "../utils/types";

// Centralized state that can be imported anywhere
interface AppState {
	inMemoryStorage: StorageData | null;
	mainWindow: BrowserWindow | null;
}

// Initialize with default values
export const state: AppState = {
	inMemoryStorage: null,
	mainWindow: null,
};

/**
 * Update the storage reference when it changes in the main process
 * This ensures we always use the latest configuration
 */
export function updateStorage(storage: StorageData | null): void {
	state.inMemoryStorage = storage;
	logInfo("Updated storage reference in shared state");
}

/**
 * Set the main window reference
 */
export function setMainWindow(window: BrowserWindow | null): void {
	state.mainWindow = window;
}
