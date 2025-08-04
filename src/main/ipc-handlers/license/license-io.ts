import { ipcMain } from 'electron'
import { updateSetting } from '../../persistence'
import { logDebug } from '../../logger'
import { state } from '../../shared/state';

export function registerLicenseIOHandlers(): void {
  ipcMain.handle('get-email', () => {
    logDebug('IPC: get-email called');
    return state.inMemoryStorage?.email ?? ''
  })

  ipcMain.handle('set-email', (_, email: string) => {
    logDebug('IPC: set-email called');
    updateSetting({ email })
    logDebug('Email saved to storage');
  })

  ipcMain.handle('get-license', () => {
    logDebug('IPC: get-license called');
    return state.inMemoryStorage?.license ?? ''
  })

  ipcMain.handle('set-license', (_, license: string) => {
    logDebug('IPC: set-license called');
    updateSetting({ license })
    logDebug('License saved to storage');
  })

  ipcMain.handle('get-instance-id', () => {
    logDebug('IPC: get-instance-id called');
    return state.inMemoryStorage?.instanceId ?? ''
  })

  ipcMain.handle('set-instance-id', (_, instanceId: string) => {
    logDebug('IPC: set-instance-id called');
    updateSetting({ instanceId })
    logDebug('Instance ID saved to storage');
  })
}