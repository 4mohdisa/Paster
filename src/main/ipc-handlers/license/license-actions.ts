import { ipcMain } from 'electron';
import { logInfo, logWarn, logError, logDebug } from '../../logger';
import { LicenseFactory } from '../../license/factory';

export function registerLicenseActionHandlers(): void {
  ipcMain.handle('validate-license', async (_, licenseKey: string, instanceId: string) => {
    logInfo('Validating license...');
    const licenseService = LicenseFactory.getInstance().getLicenseService();
    const result = await licenseService.validate(licenseKey, instanceId);
    logInfo(`License validation result: ${result}`);
    return result;
  });

  ipcMain.handle('deactivate-license', async (_, licenseKey: string, instanceId: string) => {
    logInfo('Deactivating license...');
    const licenseService = LicenseFactory.getInstance().getLicenseService();
    const result = await licenseService.deactivate(licenseKey, instanceId);

    if (result) {
      logInfo('License deactivated successfully');
    } else {
      logWarn('License deactivation failed');
    }

    return result;
  });

  ipcMain.handle('activate-license', async (_, licenseKey: string, email: string) => {
    logInfo(`Activating license for email: ${email}`);
    const licenseService = LicenseFactory.getInstance().getLicenseService();
    const result = await licenseService.activate({ email, licenseKey });

    if (result.success) {
      logInfo('License activated successfully');
    } else {
      logWarn(`License activation failed: ${result.error}`);
    }

    return {
      activation_succeeded: result.success,
      instance_id: result.instanceId,
      error: result.error
    };
  });

  ipcMain.handle('submit-survey', async (_, surveyData, email) => {
    logInfo(`Submitting survey for email: ${email}`);
    try {
      const result = await fetch('https://x9oo-fwyq-gkdq.n7.xano.io/api:1ueQQ0Od/surveys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project: 'fill-my-csv',
          source: 'desktop-app',
          data: { ...surveyData, email }
        })
      })
      const data = await result.json()
      logInfo('Survey submitted successfully');
      logDebug(`Survey response: ${data}`);
      return { success: true, data }
    } catch (error) {
      logError(`Failed to submit survey: ${error}`);
      return { success: false, error: (error as Error).message }
    }
  })

}