import { ipcMain } from 'electron';
import { processManager } from '../process-manager';
import { logInfo, logError } from '../logger';

/**
 * Register Convex-related IPC handlers
 */
export function registerConvexHandlers(): void {
  /**
   * Get Convex backend info
   */
  ipcMain.handle('convex:get-info', async () => {
    try {
      const info = processManager.getConvexInfo();
      logInfo(`IPC: convex:get-info - Running: ${info.running}`);
      return {
        success: true,
        data: info
      };
    } catch (error: any) {
      logError(`IPC: convex:get-info error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logInfo('Convex IPC handlers registered');
}