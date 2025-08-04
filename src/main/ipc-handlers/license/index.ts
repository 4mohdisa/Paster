import { logInfo } from '../../logger'
import { registerLicenseActionHandlers } from './license-actions';
import { registerLicenseIOHandlers } from './license-io'

/**
 * Registers all IPC handlers related to license management.
 */
export function registerLicenseHandlers(): void {
  logInfo('Registering all license IPC handlers')

  registerLicenseIOHandlers();
  registerLicenseActionHandlers();

  logInfo('All license IPC handlers registered successfully')
}
