import type { LicenseStorage } from '../ports';
import { getStorageFilePath, updateSetting } from '../../persistence';
import { state } from '../../shared/state';
import { logInfo, logError } from '../../logger';

export class ElectronStorage implements LicenseStorage {
  private storageFilePath: string;

  constructor() {
    this.storageFilePath = getStorageFilePath();
    logInfo(`ElectronStorage initialized with path: ${this.storageFilePath}`);
  }

  async saveLicenseDetails(userId: string, licenseKey: string, instanceId: string): Promise<void> {
    try {
      updateSetting({
        email: userId,
        license: licenseKey,
        instanceId
      })

      logInfo(`License details saved for user: ${userId}`);
    } catch (error) {
      logError(`Error saving license details: ${error}`);
      throw error;
    }
  }

  async getLicenseDetails(): Promise<{ userId: string; licenseKey: string; instanceId: string } | null> {
    try {
      const { email, instanceId, license } = state.inMemoryStorage || {};
      logInfo(`Retrieved license details for user: ${email}`);
      if (!email || !license || !instanceId) {
        logInfo('No license details found in storage file');
        return null;
      }
      return {
        userId: email,
        licenseKey: license,
        instanceId
      };
    } catch (error) {
      logError(`Error retrieving license details: ${error}`);
      return null;
    }
  }

  async clearLicenseDetails(): Promise<void> {
    try {

      updateSetting({
        email: '',
        license: '',
        instanceId: ''
      })

      logInfo('License details cleared successfully');
    } catch (error) {
      logError(`Error clearing license details: ${error}`);
      throw error;
    }
  }
}
