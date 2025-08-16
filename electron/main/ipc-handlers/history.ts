import { ipcMain, BrowserWindow, clipboard } from 'electron';
import { historyManager } from '../history-manager';
import { swiftBridge } from '../swift-bridge';
import { logInfo, logError } from '../logger';

/**
 * Register history-related IPC handlers
 */
export function registerHistoryHandlers(): void {
  // Get all history items
  ipcMain.handle('history:get-all', async (event, limit?: number) => {
    try {
      const items = await historyManager.getAll(limit);
      return {
        success: true,
        data: items
      };
    } catch (error: any) {
      logError(`Failed to get history: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get latest history item
  ipcMain.handle('history:get-latest', async () => {
    try {
      const item = await historyManager.getLatest();
      return {
        success: true,
        data: item
      };
    } catch (error: any) {
      logError(`Failed to get latest history: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Paste specific history item
  // Copy history item to clipboard
  ipcMain.handle('history:copy-item', async (event, id: string) => {
    try {
      const item = await historyManager.getById(id);
      if (!item) {
        return {
          success: false,
          error: 'History item not found'
        };
      }

      // Copy formatted content to clipboard
      clipboard.writeText(item.formatted);

      return {
        success: true,
        data: item
      };
    } catch (error: any) {
      logError(`Failed to copy history item: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Clear all history
  ipcMain.handle('history:clear', async () => {
    try {
      await historyManager.clear();
      
      // Notify UI
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        window.webContents.send('history-cleared');
      });

      return {
        success: true,
        message: 'History cleared'
      };
    } catch (error: any) {
      logError(`Failed to clear history: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Remove specific history item
  ipcMain.handle('history:remove-item', async (event, id: string) => {
    try {
      const removed = await historyManager.removeItem(id);
      if (removed) {
        // Notify UI
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
          window.webContents.send('history-item-removed', { itemId: id });
        });
      }

      return {
        success: removed,
        message: removed ? 'Item removed' : 'Item not found'
      };
    } catch (error: any) {
      logError(`Failed to remove history item: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Add item to history (called from monitor)
  ipcMain.handle('history:add-item', async (event, data: {
    original: string;
    formatted: string;
    format: string;
    metadata?: any;
  }) => {
    try {
      const id = await historyManager.addItem(
        data.original,
        data.formatted,
        data.format,
        data.metadata
      );

      // Notify UI
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        window.webContents.send('history-item-added', {
          id,
          ...data,
          timestamp: new Date().toISOString()
        });
      });

      return {
        success: true,
        id
      };
    } catch (error: any) {
      logError(`Failed to add history item: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logInfo('History handlers registered');
}