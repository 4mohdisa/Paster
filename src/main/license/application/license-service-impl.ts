import type { LicenseActivationResult, LicenseCredentials, LicenseService } from '../domain/license-service';
import type { LicenseProvider, LicenseStorage } from '../ports';
import { logInfo, logError } from '../../logger';

export class LicenseServiceImpl implements LicenseService {
  constructor(
    private licenseProvider: LicenseProvider,
    private licenseStorage: LicenseStorage
  ) {
    logInfo(`LicenseService created with provider: ${licenseProvider.name}`);
  }

  async activate(credentials: LicenseCredentials): Promise<LicenseActivationResult> {
    logInfo(`Activating license for email: ${credentials.email} with provider: ${this.licenseProvider.name}`);
    const result = await this.licenseProvider.activateLicense(credentials);

    if (result.success && result.userId && result.instanceId) {
      await this.licenseStorage.saveLicenseDetails(
        result.userId,
        credentials.licenseKey,
        result.instanceId
      );
      logInfo('License activated successfully');
    } else {
      logError(`License activation failed: ${result.error}`);
    }

    return result;
  }

  async validate(licenseKey: string, instanceId: string): Promise<boolean> {
    logInfo(`Validating license with provider: ${this.licenseProvider.name}`);
    return await this.licenseProvider.validateLicense(licenseKey, instanceId);
  }

  async deactivate(licenseKey: string, instanceId?: string): Promise<boolean> {
    logInfo(`Deactivating license with provider: ${this.licenseProvider.name}`);
    const result = await this.licenseProvider.deactivateLicense(licenseKey, instanceId);
    if (result) {
      await this.licenseStorage.clearLicenseDetails();
      logInfo('License deactivated successfully');
    } else {
      logError('License deactivation failed');
    }
    return result;
  }
}
