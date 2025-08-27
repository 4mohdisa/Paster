import { ipcMain, BrowserWindow } from 'electron';
import { KashInstaller, InstallProgress } from '../kash-installer';
import { logInfo, logError } from '../logger';

/**
 * Register IPC handlers for Kash installation
 */
export function registerKashInstallerHandlers(): void {
  logInfo('Registering Kash installer IPC handlers');

  const installer = new KashInstaller();

  // Check if Kash is installed
  ipcMain.handle('kash:check-installation', async () => {
    try {
      const installed = await installer.isKashInstalled();
      const actions = await installer.getEnabledActions();
      
      return {
        success: true,
        installed,
        actions
      };
    } catch (error) {
      logError(`Failed to check Kash installation: ${error}`);
      return {
        success: false,
        installed: false,
        actions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Install Kash with selected actions
  ipcMain.handle('kash:install', async (event, options: { actions?: string[] } = {}) => {
    try {
      const actions = options.actions || [];
      logInfo(`Installing Kash with actions: ${actions.join(', ')}`);
      
      // Send progress updates to renderer
      const onProgress = (progress: InstallProgress) => {
        event.sender.send('kash:install-progress', progress);
        
        // Also send to all windows for consistency
        BrowserWindow.getAllWindows().forEach(window => {
          if (window.webContents !== event.sender) {
            window.webContents.send('kash:install-progress', progress);
          }
        });
      };
      
      const result = await installer.installKash({
        actions: actions,
        onProgress
      });
      
      if (result.success) {
        logInfo(`Kash installed successfully`);
      } else {
        logError(`Kash installation failed: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      logError(`Kash installation error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Uninstall Kash
  ipcMain.handle('kash:uninstall', async () => {
    try {
      logInfo('Uninstalling Kash');
      const success = await installer.uninstallKash();
      
      if (success) {
        logInfo('Kash uninstalled successfully');
      } else {
        logError('Failed to uninstall Kash');
      }
      
      return { success };
    } catch (error) {
      logError(`Kash uninstall error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Install additional actions (packages only)
  ipcMain.handle('kash:install-actions', async (_event, options: { actions: string[] }) => {
    try {
      logInfo(`Installing action packages for: ${options.actions.join(', ')}`);
      
      const { getRequiredPackages } = await import('../kash-actions-config');
      const packages = getRequiredPackages(options.actions);
      
      if (packages.length > 0) {
        await installer.installActionPackages(packages);
      }
      
      // Save enabled actions
      await installer.saveEnabledActions(options.actions);
      
      return { success: true };
    } catch (error) {
      logError(`Failed to install action packages: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  logInfo('Kash installer IPC handlers registered');
}