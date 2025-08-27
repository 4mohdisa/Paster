import { logInfo } from "../logger";
import { registerSwiftHandlers } from "./swift";
import { registerProcessManagerHandlers } from "./process-manager";
// import { registerHistoryHandlers } from "./history"; // UNUSED - Using Convex for history now
import { registerConvexHandlers } from "./convex";
import { registerKashHandlers } from "./kash";
import { registerKashInstallerHandlers } from "./kash-installer";
import { registerMenubarHandlers } from "./menubar";
import type { MainWindow } from '../main-window';
import type { MenubarWindow } from '../menubar-window';

/**
 * Register IPC handlers needed by the main window app
 */
export function registerAllHandlers(mainWindow?: MainWindow, menubarWindow?: MenubarWindow): void {
	logInfo("Registering IPC handlers");
	
	// Register Swift bridge handlers (for settings)
	registerSwiftHandlers();
	
	// Register process manager handlers (for permissions & shortcuts)
	registerProcessManagerHandlers();
	
	// History handlers removed - using Convex for history now
	// registerHistoryHandlers();
	
	// Register Convex backend handlers
	registerConvexHandlers();
	
	// Register Kash integration handlers
	registerKashHandlers();
	
	// Register Kash installer handlers (for lazy-loading)
	registerKashInstallerHandlers();
	
	// Register menubar handlers if windows are provided
	if (mainWindow && menubarWindow) {
		registerMenubarHandlers(mainWindow, menubarWindow);
	}

	logInfo("IPC handlers registered successfully");
}
