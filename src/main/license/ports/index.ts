import type { LicenseCredentials, LicenseActivationResult } from '../domain/license-service';

export interface LicenseProvider {
  name: string;
  activateLicense(credentials: LicenseCredentials): Promise<LicenseActivationResult>;
  validateLicense(licenseKey: string, instanceId: string): Promise<boolean>;
  deactivateLicense(licenseKey: string, instanceId?: string): Promise<boolean>;
}

export interface LicenseStorage {
  saveLicenseDetails(userId: string, licenseKey: string, instanceId: string): Promise<void>;
  getLicenseDetails(): Promise<{ userId: string; licenseKey: string; instanceId: string } | null>;
  clearLicenseDetails(): Promise<void>;
}