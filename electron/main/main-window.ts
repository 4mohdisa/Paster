import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { getPort } from 'get-port-please';
import { startServer } from 'next/dist/server/lib/start-server';
import { logInfo, logError } from './logger';
import { app } from 'electron';

export class MainWindow {
  private window: BrowserWindow | null = null;
  private nextJSPort: number | null = null;
  private hideOnClose: boolean = true;

  constructor() {}

  /**
   * Start Next.js server in production
   */
  private async startNextJSServer(): Promise<number> {
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
  }

  /**
   * Create the main application window
   */
  async create(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      return;
    }

    try {
      // Start Next.js server if in production
      this.nextJSPort = is.dev ? 3000 : await this.startNextJSServer();

      this.window = new BrowserWindow({
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

      // Set up event handlers
      this.setupWindowEvents();

      // Load the app
      const url = is.dev
        ? 'http://localhost:3000'
        : `http://localhost:${this.nextJSPort}`;

      await this.window.loadURL(url);
      
      logInfo('Main window created successfully');
    } catch (error) {
      logError(`Failed to create main window: ${error}`);
    }
  }

  /**
   * Set up window event handlers
   */
  private setupWindowEvents(): void {
    if (!this.window) return;

    this.window.on('ready-to-show', () => {
      this.show();
    });

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // Handle window close events
    this.window.on('close', (event) => {
      // Check if we should just hide the window instead of closing
      // This will be controlled by the main process
      if (this.shouldHideOnClose()) {
        event.preventDefault();
        this.hide();
      }
    });
  }

  /**
   * Show the main window
   */
  show(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
    }
  }

  /**
   * Hide the main window
   */
  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  /**
   * Toggle window visibility
   */
  toggle(): void {
    if (!this.window || this.window.isDestroyed()) {
      this.create();
    } else if (this.window.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Focus the window
   */
  focus(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      this.window.focus();
    }
  }

  /**
   * Send data to the main window
   */
  send(channel: string, ...args: any[]): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, ...args);
    }
  }

  /**
   * Check if window exists and is not destroyed
   */
  isAlive(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  /**
   * Check if window is visible
   */
  isVisible(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  /**
   * Get the window instance
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Set whether window should hide on close
   */
  setHideOnClose(hide: boolean): void {
    this.hideOnClose = hide;
  }

  /**
   * Check if window should hide on close
   */
  private shouldHideOnClose(): boolean {
    // On macOS, always hide instead of close unless quitting
    return process.platform === 'darwin' && this.hideOnClose;
  }

  /**
   * Destroy the main window
   */
  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
  }
}