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

  /**
   * Start Convex backend
   */
  ipcMain.handle('convex:start', async () => {
    try {
      logInfo('IPC: convex:start requested');
      const started = await processManager.startConvexBackend();
      return {
        success: started,
        message: started ? 'Convex backend started' : 'Failed to start Convex backend'
      };
    } catch (error: any) {
      logError(`IPC: convex:start error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Stop Convex backend
   */
  ipcMain.handle('convex:stop', async () => {
    try {
      logInfo('IPC: convex:stop requested');
      processManager.stopConvexBackend();
      return {
        success: true,
        message: 'Convex backend stopped'
      };
    } catch (error: any) {
      logError(`IPC: convex:stop error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Restart Convex backend
   */
  ipcMain.handle('convex:restart', async () => {
    try {
      logInfo('IPC: convex:restart requested');
      processManager.stopConvexBackend();
      
      // Wait for clean shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const started = await processManager.startConvexBackend();
      return {
        success: started,
        message: started ? 'Convex backend restarted' : 'Failed to restart Convex backend'
      };
    } catch (error: any) {
      logError(`IPC: convex:restart error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logInfo('Convex IPC handlers registered');
}