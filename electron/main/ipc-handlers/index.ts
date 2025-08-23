import { logInfo } from "../logger";
import { registerSwiftHandlers } from "./swift";
import { registerProcessManagerHandlers } from "./process-manager";
import { registerHistoryHandlers } from "./history";
import { registerConvexHandlers } from "./convex";
import { registerKashHandlers } from "./kash";

/**
 * Register IPC handlers needed by the main window app
 */
export function registerAllHandlers(): void {
	logInfo("Registering IPC handlers");
	
	// Register Swift bridge handlers (for settings)
	registerSwiftHandlers();
	
	// Register process manager handlers (for permissions & shortcuts)
	registerProcessManagerHandlers();
	
	// Register history handlers (for clipboard history)
	registerHistoryHandlers();
	
	// Register Convex backend handlers
	registerConvexHandlers();
	
	// Register Kash integration handlers
	registerKashHandlers();

	logInfo("IPC handlers registered successfully");
}
