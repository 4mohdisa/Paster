import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import { EventEmitter } from 'events';
import { logInfo, logError } from './logger';

export class TrayManager extends EventEmitter {
  private tray: Tray | null = null;
  private contextMenu: Menu | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the system tray
   */
  initialize(): void {
    try {
      // Create tray icon
      const iconPath = this.getIconPath();
      
      if (process.platform === 'darwin') {
        // For macOS, use the template image directly without resizing
        // The naming convention 'trayTemplate.png' tells Electron this is a template image
        const icon = nativeImage.createFromPath(iconPath);
        icon.setTemplateImage(true);
        this.tray = new Tray(icon);
      } else {
        // For other platforms, resize appropriately
        const icon = nativeImage.createFromPath(iconPath);
        const trayIcon = icon.resize({ width: 32, height: 32 });
        this.tray = new Tray(trayIcon);
      }

      this.tray.setToolTip('AiPaste - Smart Clipboard Manager');

      // Build context menu
      this.buildContextMenu();

      // Set up event handlers
      this.setupEventHandlers();

      logInfo('Tray initialized successfully');
    } catch (error) {
      logError(`Failed to initialize tray: ${error}`);
    }
  }

  /**
   * Get the appropriate icon path based on platform
   */
  private getIconPath(): string {
    // For macOS, use template image (naming convention: trayTemplate.png)
    // Electron automatically handles @2x for Retina displays
    if (process.platform === 'darwin') {
      const templatePath = join(__dirname, '../../resources/trayTemplate.png');
      const fs = require('fs');
      if (fs.existsSync(templatePath)) {
        return templatePath;
      }
    }
    
    // For other platforms, use regular tray icon
    const trayIconPath = join(__dirname, '../../resources/tray-icon.png');
    const mainIconPath = join(__dirname, '../../resources/icon.png');
    
    // Try tray icon first, fall back to main icon
    const fs = require('fs');
    if (fs.existsSync(trayIconPath)) {
      return trayIconPath;
    }
    return mainIconPath;
  }

  /**
   * Build the context menu for the tray
   */
  private buildContextMenu(): void {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Show AiPaste',
        click: () => {
          this.emit('show-main-window');
        }
      },
      {
        label: 'Quick Paste',
        submenu: [
          {
            label: 'Paste as Markdown',
            click: () => {
              this.emit('quick-paste', { format: 'markdown' });
            }
          },
          {
            label: 'Paste as Plain Text',
            click: () => {
              this.emit('quick-paste', { format: 'plain' });
            }
          },
          {
            label: 'Paste as Table',
            click: () => {
              this.emit('quick-paste', { format: 'pretty' });
            }
          },
          {
            label: 'Paste as HTML',
            click: () => {
              this.emit('quick-paste', { format: 'html' });
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Recent Clips',
        submenu: [],
        id: 'recent-clips'
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.emit('show-settings');
        }
      },
      {
        label: 'Clipboard History',
        click: () => {
          this.emit('show-history');
        }
      },
      { type: 'separator' },
      {
        label: 'Shortcuts',
        enabled: false
      },
      {
        label: '    Smart Paste: ⌘⇧V',
        enabled: false
      },
      {
        label: '    File Convert: ⌘⇧K',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'About AiPaste',
        click: () => {
          this.emit('show-about');
        }
      },
      {
        label: 'Quit AiPaste',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          this.emit('quit-app');
          app.quit();
        }
      }
    ];

    this.contextMenu = Menu.buildFromTemplate(menuTemplate);
  }

  /**
   * Set up event handlers for the tray
   */
  private setupEventHandlers(): void {
    if (!this.tray) return;

    // Single click to show menubar window (on macOS)
    // Double click to show main window
    if (process.platform === 'darwin') {
      this.tray.on('click', (event, bounds) => {
        // If shift key is held, show main window instead
        if (event.shiftKey) {
          this.emit('show-main-window');
        } else {
          this.emit('toggle-menubar', bounds);
        }
      });

      this.tray.on('right-click', () => {
        this.showContextMenu();
      });
    } else {
      // Windows/Linux: single click shows context menu
      this.tray.on('click', () => {
        this.showContextMenu();
      });

      this.tray.on('double-click', () => {
        this.emit('show-main-window');
      });
    }
  }

  /**
   * Show the context menu
   */
  showContextMenu(): void {
    if (this.tray && this.contextMenu) {
      this.tray.popUpContextMenu(this.contextMenu);
    }
  }

  /**
   * Update recent clips in the context menu
   */
  updateRecentClips(clips: Array<{ id: string; preview: string; formatted: string }>): void {
    if (!this.contextMenu) return;

    const recentClipsMenu = clips.slice(0, 5).map((clip, index) => ({
      label: `${index + 1}. ${clip.preview.substring(0, 50)}${clip.preview.length > 50 ? '...' : ''}`,
      click: () => {
        this.emit('paste-clip', clip);
      }
    }));

    if (recentClipsMenu.length === 0) {
      recentClipsMenu.push({
        label: 'No recent clips',
        enabled: false
      } as any);
    }

    // Find and update the recent clips submenu
    const menuItems = this.contextMenu.items;
    const recentClipsItem = menuItems.find(item => item.id === 'recent-clips');
    
    if (recentClipsItem) {
      (recentClipsItem as any).submenu = Menu.buildFromTemplate(recentClipsMenu);
      
      // Rebuild the entire context menu to apply changes
      this.buildContextMenu();
      
      // Re-add the recent clips
      const newRecentClipsItem = this.contextMenu?.items.find(item => item.id === 'recent-clips');
      if (newRecentClipsItem) {
        (newRecentClipsItem as any).submenu = Menu.buildFromTemplate(recentClipsMenu);
      }
    }
  }

  /**
   * Update tray tooltip
   */
  setTooltip(tooltip: string): void {
    if (this.tray) {
      this.tray.setToolTip(tooltip);
    }
  }

  /**
   * Set tray icon image
   */
  setImage(imagePath: string): void {
    if (this.tray) {
      const icon = nativeImage.createFromPath(imagePath);
      
      if (process.platform === 'darwin') {
        // For macOS, don't resize template images
        icon.setTemplateImage(true);
        this.tray.setImage(icon);
      } else {
        // For other platforms, resize appropriately
        const trayIcon = icon.resize({ width: 32, height: 32 });
        this.tray.setImage(trayIcon);
      }
    }
  }

  /**
   * Destroy the tray
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.contextMenu = null;
    }
  }

  /**
   * Check if tray is initialized
   */
  isInitialized(): boolean {
    return this.tray !== null;
  }

  /**
   * Get tray bounds for positioning windows
   */
  getBounds(): Electron.Rectangle | undefined {
    return this.tray?.getBounds();
  }
}