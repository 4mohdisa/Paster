// Import all handler registration functions

import { logInfo } from "../logger";
import { registerLicenseHandlers } from "./license";

/**
 * Register all IPC handlers throughout the application
 * This function should be called once during app initialization
 */
export function registerAllHandlers(): void {
	logInfo("Registering all IPC handlers");

	// Register license handlers
	registerLicenseHandlers();

	logInfo("All IPC handlers registered successfully");
}
