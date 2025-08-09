import { ipcMain, BrowserWindow, systemPreferences } from 'electron';
import { processManager } from '../process-manager';
import { logInfo, logError } from '../logger';

/**
 * Register process manager IPC handlers
 */
export function registerProcessManagerHandlers(): void {
  // Forward permission-required events to renderer
  processManager.on('permission-required', (data) => {
    logInfo(`Permission required: ${JSON.stringify(data)}`);
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('permission-required', data);
    });
  });

  // Check system permissions
  ipcMain.handle('process:check-permissions', async () => {
    try {
      const permissions = processManager.checkPermissions();
      return {
        success: true,
        data: permissions
      };
    } catch (error: any) {
      logError(`Failed to check permissions: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Request accessibility permission
  ipcMain.handle('process:request-permission', async () => {
    try {
      logInfo('Requesting accessibility permission via Electron...');
      
      // Check current status
      const isCurrentlyTrusted = systemPreferences.isTrustedAccessibilityClient(false);
      
      if (isCurrentlyTrusted) {
        return {
          success: true,
          granted: true,
          message: 'Permission already granted'
        };
      }
      
      // Request permission (shows system prompt)
      systemPreferences.isTrustedAccessibilityClient(true);
      
      // Wait a moment and check again
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isNowTrusted = systemPreferences.isTrustedAccessibilityClient(false);
      
      return {
        success: true,
        granted: isNowTrusted,
        message: isNowTrusted ? 'Permission granted' : 'Permission pending - please grant in System Preferences'
      };
    } catch (error: any) {
      logError(`Failed to request permission: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });
  // Get status of all managed processes
  ipcMain.handle('process:status', async () => {
    try {
      const status = processManager.getStatus();
      logInfo(`Process status requested: ${JSON.stringify(status)}`);
      return {
        success: true,
        data: status
      };
    } catch (error: any) {
      logError(`Failed to get process status: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Check if shortcuts daemon is running
  ipcMain.handle('process:shortcuts-status', async () => {
    try {
      const isRunning = processManager.isShortcutsDaemonRunning();
      logInfo(`Shortcuts daemon status: ${isRunning ? 'running' : 'stopped'}`);
      return {
        success: true,
        isRunning
      };
    } catch (error: any) {
      logError(`Failed to check shortcuts daemon status: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Restart shortcuts daemon
  ipcMain.handle('process:restart-shortcuts', async () => {
    try {
      logInfo('Restarting shortcuts daemon via IPC...');
      const success = await processManager.restartShortcutsDaemon();
      return {
        success,
        message: success ? 'Shortcuts daemon restarted' : 'Failed to restart shortcuts daemon'
      };
    } catch (error: any) {
      logError(`Failed to restart shortcuts daemon: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Start shortcuts daemon (if not running)
  ipcMain.handle('process:start-shortcuts', async () => {
    try {
      if (processManager.isShortcutsDaemonRunning()) {
        return {
          success: true,
          message: 'Shortcuts daemon already running'
        };
      }
      
      logInfo('Starting shortcuts daemon via IPC...');
      const success = await processManager.startShortcutsDaemon();
      return {
        success,
        message: success ? 'Shortcuts daemon started' : 'Failed to start shortcuts daemon'
      };
    } catch (error: any) {
      logError(`Failed to start shortcuts daemon: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Stop shortcuts daemon
  ipcMain.handle('process:stop-shortcuts', async () => {
    try {
      logInfo('Stopping shortcuts daemon via IPC...');
      processManager.stopProcess('shortcuts-daemon');
      return {
        success: true,
        message: 'Shortcuts daemon stopped'
      };
    } catch (error: any) {
      logError(`Failed to stop shortcuts daemon: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });
}