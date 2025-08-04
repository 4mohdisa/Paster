import type { LicenseProvider } from '../ports';
import type { LicenseCredentials, LicenseActivationResult } from '../domain/license-service';

export class DefaultLicenseProvider implements LicenseProvider {
  name = 'default';

  async activateLicense(credentials: LicenseCredentials): Promise<LicenseActivationResult> {
    throw new Error('No license provider configured. Please run CLI setup.');
  }

  async validateLicense(licenseKey: string, instanceId: string): Promise<boolean> {
    throw new Error('No license provider configured. Please run CLI setup.');
  }

  async deactivateLicense(licenseKey: string, instanceId?: string): Promise<boolean> {
    throw new Error('No license provider configured. Please run CLI setup.');
  }
}

export const licenseProvider = new DefaultLicenseProvider();

export { DefaultLicenseProvider as LicenseProviderClass };