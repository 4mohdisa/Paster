import { ipcMain } from 'electron';
import { settingsManager } from '../settings-manager';
import { logInfo, logError } from '../logger';

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(): void {
  // Get onboarding status
  ipcMain.handle('settings:get-onboarding-status', async () => {
    try {
      const completed = settingsManager.isOnboardingCompleted();
      logInfo(`Settings: Onboarding completed = ${completed}`);
      return {
        success: true,
        data: { completed }
      };
    } catch (error: any) {
      logError(`Settings: Failed to get onboarding status: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Set onboarding complete
  ipcMain.handle('settings:set-onboarding-complete', async () => {
    try {
      settingsManager.setOnboardingCompleted(true);
      logInfo('Settings: Marked onboarding as complete');
      return {
        success: true,
        message: 'Onboarding marked as complete'
      };
    } catch (error: any) {
      logError(`Settings: Failed to set onboarding complete: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Reset onboarding (for testing or re-setup)
  ipcMain.handle('settings:reset-onboarding', async () => {
    try {
      settingsManager.setOnboardingCompleted(false);
      logInfo('Settings: Reset onboarding status');
      return {
        success: true,
        message: 'Onboarding reset'
      };
    } catch (error: any) {
      logError(`Settings: Failed to reset onboarding: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get all settings
  ipcMain.handle('settings:get-all', async () => {
    try {
      const settings = settingsManager.getAll();
      return {
        success: true,
        data: settings
      };
    } catch (error: any) {
      logError(`Settings: Failed to get all settings: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logInfo('Settings IPC handlers registered');
}