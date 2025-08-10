import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { getPort } from 'get-port-please';
import { startServer } from 'next/dist/server/lib/start-server';
import { join } from 'node:path';
import { checkForUpdatesAndNotify, setupAutoUpdater } from './auto-updater';

import { startPostgresServer, stopPostgresServer } from './db/postgres-manager';
import { initRedis, startRedisServer, stopRedisServer } from './db/redis-manager';
import { registerAllHandlers } from './ipc-handlers';
import { logDebug, logError, logInfo } from './logger';
import { getStorageFilePath, readStorage } from './persistence';
import { processManager } from './process-manager';
import { updateStorage } from './shared/state';
import type { StorageData } from './utils/types';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logInfo('Another instance is already running, exiting...');
  app.quit();
  process.exit(0);
}

// Only continue if we got the lock
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window instead.
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();

  }
});

// Add cleanup handlers for development
if (is.dev) {
  const cleanup = () => {
    logInfo('Development cleanup: releasing single instance lock');
    app.releaseSingleInstanceLock();
    // Stop all processes
    processManager.stopAllProcesses().then(() => {
      process.exit(0);
    }).catch(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGUSR2', cleanup); // nodemon uses this
  process.on('exit', () => {
    app.releaseSingleInstanceLock();
  });
}

logInfo('Application starting...');
logInfo(`User data path: ${app.getPath('userData')}`);

const isDatabaseOnlyMode = process.argv.includes('--database-only');
const isHeadlessMode = process.argv.includes('--headless');

if (isDatabaseOnlyMode) {
  logInfo('🗄️ Database-only mode detected');
}

const iconName = 'icon.png';
const icon = is.dev
  ? join(__dirname, '..', '..', 'resources', iconName)
  : join(process.resourcesPath, iconName);

let mainWindow: BrowserWindow;
let inMemoryStorage: StorageData = {};
const storageFilePath = getStorageFilePath();

const startNextJSServer = async () => {
  try {
    logInfo('Starting Next.js server...');
    const nextJSPort = await getPort({ portRange: [30011, 50000] });
    logInfo(`Selected port for Next.js server: ${nextJSPort}`);
    const webDir = join(app.getAppPath(), 'app');

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

    logInfo(`Next.js server started successfully on port: ${nextJSPort}`);
    return nextJSPort;
  } catch (error) {
    logError('Error starting Next.js server:');
    throw error;
  }
};

function createWindow(isMac: boolean): void {
  // Skip window creation in database-only or headless mode
  if (isDatabaseOnlyMode || isHeadlessMode) {
    logInfo('Skipping window creation (database-only or headless mode)');
    return;
  }

  logInfo('Creating main application window...');

  mainWindow = new BrowserWindow({
    icon: icon,
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: isMac,
    frame: !isMac,
    titleBarStyle: isMac ? 'hidden' : 'default',
    trafficLightPosition: { x: 10, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    logInfo(`Storage file path: ${storageFilePath}`);
    mainWindow.show();
    logInfo('Main window is now visible');
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    logInfo(`Opening external URL: ${details.url}`);
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      const requestHeaders = {
        ...details.requestHeaders,
        'x-electron-app': 'true',
      };
      callback({ requestHeaders });
    },
  );

  const loadURL = async () => {
    if (is.dev) {
      logInfo('Development mode detected, loading from localhost:3000');
      mainWindow.loadURL('http://localhost:3000');
      // mainWindow.webContents.openDevTools();
    } else {
      try {
        logInfo('Production mode detected, starting built-in Next.js server');
        const port = await startNextJSServer();
        logInfo(`Next.js server started on port: ${port}`);
        mainWindow.loadURL(`http://localhost:${port}`);
      } catch (error) {
        logError('Failed to load Next.js app:');
      }
    }
  };

  loadURL();
}

app.whenReady().then(async () => {
  logInfo('Application ready event triggered');
  const isMac = process.platform === 'darwin';
  logInfo(`Platform detected: ${process.platform}`);

  // Only initialize full app features if not in database-only mode
  if (!isDatabaseOnlyMode) {
    electronApp.setAppUserModelId('com.electron');
    initializeInMemoryStorage();
    updateStorage(inMemoryStorage);
    logInfo('In-memory storage initialized');

    // Register IPC handlers
    registerAllHandlers();

    // Start the shortcuts daemon for global keyboard monitoring
    logInfo('Starting shortcuts daemon for keyboard monitoring...');

    // Set up event forwarding from process manager to UI
    processManager.on('permission-required', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-required', data);
      }
    });

    processManager.on('permission-granted', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-granted', data);
      }
    });

    processManager.on('clipboard-formatted', (data) => {
      // Forward clipboard formatting events to UI
      logInfo('Clipboard formatted event received, forwarding to UI...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        logInfo('Sending history-item-added to UI');
        mainWindow.webContents.send('history-item-added', data);
      } else {
        logInfo('Main window not available to send event');
      }
    });

    processManager.on('shortcut-triggered', async (data) => {
      // When shortcut is triggered, paste from history
      if (data.historyItem) {
        const { clipboard } = require('electron');
        const { swiftBridge } = require('./swift-bridge');
        
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

    // Add a small delay to ensure window is ready for permission dialogs
    setTimeout(async () => {
      // Start clipboard monitor for auto-formatting
      const monitorSuccess = await processManager.startClipboardMonitor();
      if (monitorSuccess) {
        logInfo('Clipboard monitor started successfully');
      } else {
        logInfo('Clipboard monitor not started - permission may be required');
      }
      
      // Start shortcuts daemon for keyboard monitoring
      const shortcutsSuccess = await processManager.startShortcutsDaemon();
      if (shortcutsSuccess) {
        logInfo('Shortcuts daemon started successfully');
      } else {
        logInfo('Shortcuts daemon not started - permission may be required');
      }
    }, 2000); // 2 second delay for window to be ready
  }

  // Always start PostgreSQL server
  await startPostgresServer();

  // Only start Redis and other services if not in database-only mode
  if (!isDatabaseOnlyMode) {
    try {
      startRedisServer();
      await initRedis();
    } catch (error) {
      logError(`Failed to start Redis server: ${error}`);
    }

    app.on('browser-window-created', (_, window) => {
      logDebug('New browser window created');
      optimizer.watchWindowShortcuts(window);
    });

    // IPC test
    ipcMain.on('ping', () => logDebug('IPC ping received, responding with pong'));

    // AutoUpdater comes from a library function.
    logInfo('Setting up auto-updater...');
    setupAutoUpdater();

    logInfo('Creating main application window...');
    createWindow(isMac);

    app.on('activate', () => {
      logInfo('App activated');
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        logInfo('No windows found, creating a new one');
        createWindow(isMac);
      }
    });
  } else {
    // Database-only mode: keep the process alive for database operations
    logInfo('🗄️ Database server is running and ready');
    console.log('✅ PostgreSQL server started on port 5434');
    console.log('💡 You can now run database operations (db:push, db:migrate, etc.)');
    console.log('🛑 Press Ctrl+C to stop the database server');

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logInfo(`Received ${signal}. Shutting down database server...`);
      await stopPostgresServer();
      logInfo('Database server stopped. Exiting...');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  function initializeInMemoryStorage(): void {
    logInfo('Initializing in-memory storage...');
    inMemoryStorage = readStorage(storageFilePath);
    logInfo('Initial storage loaded');
    logDebug(`Initial storage: ${inMemoryStorage}`);
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  logInfo('All windows closed');

  // Always stop servers
  logInfo('Stopping PostgreSQL server...');
  await stopPostgresServer();

  if (!isDatabaseOnlyMode) {
    logInfo('Stopping Redis server...');
    await stopRedisServer();
  }

  if (process.platform !== 'darwin') {
    logInfo('Not on macOS, quitting application');
    app.quit();
  } else {
    logInfo('On macOS, keeping app active in background');
  }
});

app.on('before-quit', async () => {
  logInfo('Application is about to quit');
  logInfo('Stopping PostgreSQL server...');
  await stopPostgresServer();

  if (!isDatabaseOnlyMode) {
    logInfo('Stopping Redis server...');
    await stopRedisServer();
  }

  logInfo('Application exiting');
  app.exit();
});

// This is to notify the user when the app update is ready.
app.on('ready', () => {
  if (!isDatabaseOnlyMode) {
    logInfo('Checking for updates...');
    checkForUpdatesAndNotify();
  }
});
