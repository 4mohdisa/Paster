// Import all handler registration functions

import { logInfo } from "../logger";
import { registerLicenseHandlers } from "./license";
import { registerSwiftHandlers } from "./swift";
import { registerProcessManagerHandlers } from "./process-manager";

/**
 * Register all IPC handlers throughout the application
 * This function should be called once during app initialization
 */
export function registerAllHandlers(): void {
	logInfo("Registering all IPC handlers");

	// Register license handlers
	registerLicenseHandlers();
	
	// Register Swift bridge handlers
	registerSwiftHandlers();
	
	// Register process manager handlers
	registerProcessManagerHandlers();

	logInfo("All IPC handlers registered successfully");
}
