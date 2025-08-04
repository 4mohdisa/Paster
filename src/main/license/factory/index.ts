import type { LicenseService } from '../domain/license-service';
import { LicenseServiceImpl } from '../application/license-service-impl';
import { ElectronStorage } from '../storage/electron-storage';
import { licenseProvider } from '../license-provider';
import { logInfo } from '../../logger';

export class LicenseFactory {
  private static instance: LicenseFactory;
  private licenseService: LicenseService | null = null;

  private constructor() {
    logInfo(`LicenseFactory initialized with provider: ${licenseProvider.name}`);
  }

  static getInstance(): LicenseFactory {
    if (!LicenseFactory.instance) {
      LicenseFactory.instance = new LicenseFactory();
    }
    return LicenseFactory.instance;
  }

  getLicenseService(): LicenseService {
    if (!this.licenseService) {
      const storage = new ElectronStorage();
      this.licenseService = new LicenseServiceImpl(licenseProvider, storage);
      logInfo(`License service created with provider: ${licenseProvider.name}`);
    }

    return this.licenseService;
  }

  getProviderName(): string {
    return licenseProvider.name;
  }

  resetLicenseService(): void {
    this.licenseService = null;
    logInfo('License service reset');
  }
}