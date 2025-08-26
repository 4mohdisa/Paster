import { BrowserWindow, screen, shell, Rectangle, ipcMain } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { logInfo, logError } from './logger';

export class MenubarWindow {
  private window: BrowserWindow | null = null;
  private menubarPort: number | null = null;
  private isVisible: boolean = false;

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Create the menubar popup window
   */
  async create(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      return;
    }

    try {
      // In development, the menubar app runs on a different port
      if (is.dev) {
        this.menubarPort = 5173; // Vite default for menubar app
      }

      const windowOptions: Electron.BrowserWindowConstructorOptions = {
        width: 380,
        height: 480,
        show: false,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false,
          nodeIntegration: false,
          contextIsolation: true,
        },
        backgroundColor: '#1a1a1a',
        titleBarStyle: 'customButtonsOnHover',
        trafficLightPosition: { x: -100, y: -100 }, // Hide traffic lights
      };

      // Add platform-specific options
      if (process.platform === 'darwin') {
        windowOptions.vibrancy = 'popover';
        windowOptions.visualEffectState = 'active';
      } else if (process.platform === 'win32') {
        windowOptions.transparent = true;
      }

      this.window = new BrowserWindow(windowOptions);

      // Handle window events
      this.setupWindowEvents();

      // Load the menubar app
      await this.loadContent();

      logInfo('Menubar window created successfully');
    } catch (error) {
      logError(`Failed to create menubar window: ${error}`);
    }
  }

  /**
   * Load content into the menubar window
   */
  private async loadContent(): Promise<void> {
    if (!this.window) return;

    try {
      if (is.dev && this.menubarPort) {
        // In development, load from Vite dev server
        await this.window.loadURL(`http://localhost:${this.menubarPort}`);
        // Open devtools in detached mode for debugging
        if (process.env.DEBUG_MENUBAR === 'true') {
          this.window.webContents.openDevTools({ mode: 'detach' });
        }
      } else {
        // In production, load built files
        const menubarPath = join(__dirname, '../../app/menubar/index.html');
        await this.window.loadFile(menubarPath);
      }
    } catch (error) {
      logError(`Failed to load menubar content: ${error}`);
      // Fallback: show a simple error message
      this.window.loadURL(`data:text/html,
        <html>
          <body style="font-family: system-ui; padding: 20px; background: #1a1a1a; color: white;">
            <h3>Menubar Loading Error</h3>
            <p>Failed to load menubar content. Please restart the application.</p>
          </body>
        </html>
      `);
    }
  }

  /**
   * Set up window event handlers
   */
  private setupWindowEvents(): void {
    if (!this.window) return;

    // Hide window when it loses focus
    this.window.on('blur', () => {
      if (!this.window?.webContents.isDevToolsOpened()) {
        this.hide();
      }
    });

    // Handle external links
    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    // Clean up on close
    this.window.on('closed', () => {
      this.window = null;
      this.isVisible = false;
    });

    // Prevent navigation away from the app
    this.window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });
  }

  /**
   * Set up IPC handlers for menubar-specific communication
   */
  private setupIpcHandlers(): void {
    // Hide menubar window
    ipcMain.handle('menubar:hide', () => {
      this.hide();
    });

    // Get window visibility state
    ipcMain.handle('menubar:is-visible', () => {
      return this.isVisible;
    });

    // Resize window
    ipcMain.handle('menubar:resize', (_, height: number) => {
      if (this.window && !this.window.isDestroyed()) {
        const [width] = this.window.getSize();
        this.window.setSize(width, Math.min(Math.max(height, 200), 800));
      }
    });
  }

  /**
   * Position and show the menubar window
   */
  async show(trayBounds?: Rectangle): Promise<void> {
    if (!this.window) {
      await this.create();
    }

    if (!this.window || this.window.isDestroyed()) return;

    // Calculate position
    const position = this.calculatePosition(trayBounds);
    
    // Set position and show
    this.window.setPosition(position.x, position.y, false);
    this.window.show();
    this.window.focus();
    this.isVisible = true;

    logInfo(`Menubar window shown at position: ${position.x}, ${position.y}`);
  }

  /**
   * Hide the menubar window
   */
  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
      this.isVisible = false;
      logInfo('Menubar window hidden');
    }
  }

  /**
   * Toggle menubar visibility
   */
  async toggle(trayBounds?: Rectangle): Promise<void> {
    if (this.isVisible) {
      this.hide();
    } else {
      await this.show(trayBounds);
    }
  }

  /**
   * Calculate the position for the menubar window
   */
  private calculatePosition(trayBounds?: Rectangle): { x: number; y: number } {
    const { width: windowWidth, height: windowHeight } = this.window!.getBounds();
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    let x = Math.round(screenWidth - windowWidth - 10);
    let y = 10;

    if (trayBounds) {
      // Position below tray icon on macOS
      if (process.platform === 'darwin') {
        x = Math.round(trayBounds.x + trayBounds.width / 2 - windowWidth / 2);
        y = Math.round(trayBounds.y + trayBounds.height + 5);
      } 
      // Position above tray icon on Windows/Linux (usually bottom taskbar)
      else {
        x = Math.round(trayBounds.x + trayBounds.width / 2 - windowWidth / 2);
        y = Math.round(trayBounds.y - windowHeight - 5);
      }

      // Ensure window stays within screen bounds
      x = Math.max(10, Math.min(x, screenWidth - windowWidth - 10));
      y = Math.max(10, Math.min(y, screenHeight - windowHeight - 10));
    }

    return { x, y };
  }

  /**
   * Send data to the menubar window
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
   * Get the window instance
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Destroy the menubar window
   */
  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
      this.isVisible = false;
    }
  }
}