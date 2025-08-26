import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';
import { registerAllHandlers } from './ipc-handlers';
import { logError, logInfo } from './logger';
import { MainWindow } from './main-window';
import { MenubarWindow } from './menubar-window';
import { TrayManager } from './tray-manager';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Window and tray instances
const mainWindow = new MainWindow();
const menubarWindow = new MenubarWindow();
const trayManager = new TrayManager();

// Track if app is quitting (used to determine window close behavior)
let isAppQuitting = false;

// Export for other modules if needed
export { isAppQuitting };

// Set up tray event handlers
function setupTrayEvents(): void {
  trayManager.on('show-main-window', () => {
    mainWindow.show();
  });

  trayManager.on('toggle-menubar', async (bounds) => {
    await menubarWindow.toggle(bounds);
  });

  trayManager.on('show-settings', () => {
    mainWindow.show();
    mainWindow.send('navigate', '/settings');
  });

  trayManager.on('show-history', () => {
    mainWindow.show();
    mainWindow.send('navigate', '/history');
  });

  trayManager.on('show-about', () => {
    mainWindow.show();
    mainWindow.send('navigate', '/about');
  });

  trayManager.on('quick-paste', (options) => {
    // Handle quick paste from tray
    logInfo(`Quick paste requested with format: ${options.format}`);
    // TODO: Implement quick paste logic
  });

  trayManager.on('paste-clip', (clip) => {
    // Handle pasting a specific clip from history
    logInfo(`Paste clip requested: ${clip.id}`);
    // TODO: Implement paste clip logic
  });

  trayManager.on('quit-app', () => {
    isAppQuitting = true;
    mainWindow.setHideOnClose(false);
    app.quit();
  });
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.aipaste.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Register IPC handlers for process, history, and swift
  registerAllHandlers();

  // Initialize tray
  trayManager.initialize();
  setupTrayEvents();

  // Create main window (but don't show it immediately if we have tray)
  await mainWindow.create();

  // Only show main window on first launch or if tray is not supported
  if (!trayManager.isInitialized()) {
    mainWindow.show();
  }

  // Start the daemons after window is created
  const { processManager } = await import('./process-manager');

  // Set up event listeners for process manager
  processManager.on('shortcut-triggered', async (data) => {
    // When shortcut is triggered, paste from history
    if (data.historyItem) {
      const { clipboard } = require('electron');
      const { swiftBridge } = await import('./swift-bridge');

      // Save current clipboard
      const originalClipboard = clipboard.readText();

      // Set clipboard to formatted content from history
      clipboard.writeText(data.historyItem.formatted);

      // Trigger system paste (just Cmd+V, no formatting)
      await swiftBridge.triggerSystemPaste();

      // Restore original clipboard after a delay
      setTimeout(() => {
        clipboard.writeText(originalClipboard);
      }, 100);

      // Notify UI
      mainWindow.send('shortcut-triggered', data);
    }
  });

  // Start Convex backend (doesn't need permissions)
  try {
    logInfo('Starting Convex backend...');
    await processManager.startConvexBackend();
  } catch (error: any) {
    logError(`Failed to start Convex backend: ${error.message}`);
    // Continue running - app can work without Convex
  }

  // Listen for Convex events
  processManager.on('convex-ready', async (info) => {
    logInfo(`Convex backend ready at ${info.backendUrl}`);

    // Initialize Convex client for backend use
    const { convexClient } = await import('./convex-client');
    convexClient.initialize(info.backendUrl);

    mainWindow.send('convex-ready', info);
    menubarWindow.send('convex-ready', info);
  });

  processManager.on('convex-error', (error) => {
    logError(`Convex backend error: ${error.message}`);
    mainWindow.send('convex-error', error);
    menubarWindow.send('convex-error', error);
  });

  // Check permissions and start daemons
  const permissions = processManager.checkPermissions();
  if (permissions.accessibility) {
    // Start clipboard monitor
    await processManager.startClipboardMonitor();
    // Start shortcuts daemon
    await processManager.startShortcutsDaemon();
  } else {
    logInfo('Waiting for accessibility permission before starting daemons');
  }

  app.on('activate', () => {
    // On macOS, re-create windows when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow.create();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray even when all windows are closed
  if (process.platform !== 'darwin') {
    // On Windows/Linux, check if we have tray
    if (!trayManager.isInitialized()) {
      app.quit();
    }
  }
  // On macOS, app stays in dock/tray
});

// Handle process termination signals for proper cleanup
process.on('SIGINT', () => {
  logInfo('Received SIGINT, cleaning up...');
  app.quit();
});

process.on('SIGTERM', () => {
  logInfo('Received SIGTERM, cleaning up...');
  app.quit();
});

app.on('before-quit', async () => {
  logInfo('App is quitting, cleaning up processes...');
  isAppQuitting = true;
  mainWindow.setHideOnClose(false);

  // Clean up tray
  trayManager.destroy();

  // Explicitly shut down the process manager
  const { processManager } = await import('./process-manager');
  processManager.shutdown();
});