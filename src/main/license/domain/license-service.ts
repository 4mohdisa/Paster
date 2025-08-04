export interface LicenseCredentials {
  email: string;
  licenseKey: string;
}

export interface LicenseActivationResult {
  success: boolean;
  userId?: string;
  instanceId?: string;
  error?: string;
}

export interface LicenseService {
  activate(credentials: LicenseCredentials): Promise<LicenseActivationResult>;
  validate(licenseKey: string, instanceId: string): Promise<boolean>;
  deactivate(licenseKey: string, instanceId?: string): Promise<boolean>;
}
