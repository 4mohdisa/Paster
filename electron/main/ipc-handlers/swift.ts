import { ipcMain } from 'electron';
import { swiftBridge } from '../swift-bridge';
import { logInfo, logError } from '../logger';

export function registerSwiftHandlers(): void {
  logInfo('Registering Swift bridge IPC handlers');

  // REMOVED: swift:test - Was only for development testing

  // Format table data
  ipcMain.handle('swift:format-table', async (_, input: string, format?: string) => {
    try {
      const formatted = await swiftBridge.formatTable(
        input,
        (format as 'simple' | 'markdown' | 'html') || 'simple'
      );
      return { success: true, data: formatted };
    } catch (error: any) {
      logError(`Format table error: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // Execute paste flow
  ipcMain.handle('swift:execute-paste', async (_, options?: { noPrefix?: boolean; simulate?: boolean }) => {
    try {
      const success = await swiftBridge.executePaste(options);
      return { success };
    } catch (error: any) {
      logError(`Execute paste error: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // Start clipboard monitoring
  ipcMain.handle('swift:start-monitor', async () => {
    try {
      swiftBridge.startClipboardMonitor((data) => {
        // We'll implement this when we add the monitor command
        logInfo(`Clipboard data formatted: ${data}`);
      });
      return { success: true };
    } catch (error: any) {
      logError(`Start monitor error: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // Stop clipboard monitoring
  ipcMain.handle('swift:stop-monitor', async () => {
    try {
      swiftBridge.stopClipboardMonitor();
      return { success: true };
    } catch (error: any) {
      logError(`Stop monitor error: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // Get settings
  ipcMain.handle('swift:get-settings', async () => {
    try {
      const settings = await swiftBridge.getSettings();
      return { success: true, data: settings };
    } catch (error: any) {
      logError(`Get settings error: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // Update settings
  ipcMain.handle('swift:update-settings', async (_, settings) => {
    try {
      const success = await swiftBridge.updateSettings(settings);
      return { success };
    } catch (error: any) {
      logError(`Update settings error: ${error}`);
      return { success: false, error: error.message };
    }
  });
}