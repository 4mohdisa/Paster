import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, shell } from 'electron';
import { getPort } from 'get-port-please';
import { startServer } from 'next/dist/server/lib/start-server';
import { join } from 'node:path';
import { registerAllHandlers } from './ipc-handlers';
import { logInfo, logError } from './logger';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

// Start Next.js server in production
const startNextJSServer = async () => {
  const nextJSPort = await getPort({ portRange: [30011, 50000] });
  const webDir = join(app.getAppPath(), 'app/main-window');

  await startServer({
    dir: webDir,
    isDev: false,
    hostname: 'localhost',
    port: nextJSPort,
    customServer: true,
    allowRetry: false,
    keepAliveTimeout: 5000,
    minimalMode: true,
  });

  logInfo(`Next.js server started on port: ${nextJSPort}`);
  return nextJSPort;
};

// Create main window
async function createMainWindow(): Promise<void> {
  const nextJSPort = is.dev ? 3000 : await startNextJSServer();

  mainWindow = new BrowserWindow({
    width: 900,
    height: 850,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const url = is.dev
    ? 'http://localhost:3000'
    : `http://localhost:${nextJSPort}`;

  mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.aipaste.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Register IPC handlers for process, history, and swift
  registerAllHandlers();

  await createMainWindow();

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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-triggered', data);
      }
    }
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
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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

app.on('before-quit', () => {
  logInfo('App is quitting, cleaning up processes...');
  // Process manager will handle cleanup in its shutdown method
});