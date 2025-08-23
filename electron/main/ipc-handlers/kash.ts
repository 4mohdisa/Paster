import { ipcMain, BrowserWindow } from 'electron';
import { pythonBridge } from '../python-bridge';
import { swiftBridge } from '../swift-bridge';
import { logInfo, logError } from '../logger';
import { processManager } from '../process-manager';

interface KashActionRequest {
  action: string;
  files?: string[];
  useSelection?: boolean;  // If true, get files from Finder
}

/**
 * Register IPC handlers for Kash integration
 */
export function registerKashHandlers(): void {
  logInfo('Registering Kash IPC handlers');

  // Process files with Kash action
  ipcMain.handle('kash:process-files', async (_event, request: KashActionRequest) => {
    try {
      let filesToProcess = request.files || [];

      // If useSelection is true, get files from Finder
      if (request.useSelection) {
        logInfo('Getting Finder selection for Kash action');
        const selectionResult = await swiftBridge.getFinderSelection();
        
        if (selectionResult.success && selectionResult.data) {
          filesToProcess = selectionResult.data.split('\n').filter(f => f.trim());
        } else {
          return {
            success: false,
            error: 'No files selected in Finder'
          };
        }
      }

      if (filesToProcess.length === 0) {
        return {
          success: false,
          error: 'No files to process'
        };
      }

      logInfo(`Processing ${filesToProcess.length} files with action: ${request.action}`);
      
      const result = await pythonBridge.runKashAction({
        action: request.action,
        files: filesToProcess
      });

      return result;
    } catch (error) {
      logError(`Kash action failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get current Finder selection
  ipcMain.handle('kash:get-finder-selection', async () => {
    try {
      const result = await swiftBridge.getFinderSelection();
      
      if (result.success && result.data) {
        const files = result.data.split('\n').filter(f => f.trim());
        return {
          success: true,
          files
        };
      } else {
        return {
          success: true,
          files: []
        };
      }
    } catch (error) {
      logError(`Failed to get Finder selection: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        files: []
      };
    }
  });

  // Monitor Finder selection changes
  ipcMain.handle('kash:start-selection-monitor', async () => {
    try {
      
      // Start the Finder selection monitor
      const monitorStarted = await processManager.startFinderMonitor();
      
      if (monitorStarted) {
        logInfo('Finder selection monitor started');
        
        // Listen for selection changes
        processManager.on('finder-selection-changed', (data) => {
          // Send to all renderer windows
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('kash:selection-changed', {
              files: data.split('\n').filter(f => f.trim())
            });
          });
        });
        
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Failed to start Finder monitor'
        };
      }
    } catch (error) {
      logError(`Failed to start selection monitor: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Stop monitoring Finder selection
  ipcMain.handle('kash:stop-selection-monitor', async () => {
    try {
      processManager.stopFinderMonitor();
      
      return { success: true };
    } catch (error) {
      logError(`Failed to stop selection monitor: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Check Python/Kash dependencies
  ipcMain.handle('kash:check-dependencies', async () => {
    try {
      const deps = await pythonBridge.checkDependencies();
      return {
        success: true,
        dependencies: deps
      };
    } catch (error) {
      logError(`Failed to check dependencies: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  logInfo('Kash IPC handlers registered');
}