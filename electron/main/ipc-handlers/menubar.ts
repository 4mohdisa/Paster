import { app, ipcMain } from 'electron';
import { logInfo } from '../logger';
import type { MainWindow } from '../main-window';
import type { MenubarWindow } from '../menubar-window';

/**
 * Register menubar-specific IPC handlers
 */
export function registerMenubarHandlers(
  mainWindow: MainWindow,
  menubarWindow: MenubarWindow
): void {
  // Show main window (dashboard)
  ipcMain.handle('menubar:show-main-window', () => {
    logInfo('Showing main window from menubar');
    mainWindow.show();
    menubarWindow.hide();
    return { success: true };
  });

  // Quit application
  ipcMain.handle('menubar:quit-app', () => {
    logInfo('Quitting application from menubar');
    app.quit();
    return { success: true };
  });


  logInfo('Menubar IPC handlers registered');
}