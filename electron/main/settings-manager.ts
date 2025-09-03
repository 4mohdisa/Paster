import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logInfo, logError } from './logger';

interface AppSettings {
  onboardingCompleted: boolean;
  firstLaunchDate?: string;
  lastLaunchDate?: string;
  // Add more settings as needed
}

class SettingsManager {
  private static instance: SettingsManager;
  private settingsPath: string;
  private settings: AppSettings;

  private constructor() {
    // Store settings in userData for production, project root for dev
    const isDev = !app.isPackaged;
    if (isDev) {
      // Development: store in project root so it gets cleaned by fresh
      this.settingsPath = path.join(app.getAppPath(), '.aipaste-settings.json');
    } else {
      // Production: store in userData
      const userDataPath = app.getPath('userData');
      this.settingsPath = path.join(userDataPath, 'settings.json');
    }

    logInfo(`SettingsManager: Using settings file at ${this.settingsPath}`);
    this.settings = this.loadSettings();
  }

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const loaded = JSON.parse(data) as AppSettings;
        logInfo('SettingsManager: Loaded existing settings');
        return loaded;
      }
    } catch (error: any) {
      logError(`SettingsManager: Failed to load settings: ${error.message}`);
    }

    // Return default settings
    logInfo('SettingsManager: Using default settings');
    return {
      onboardingCompleted: false,
      firstLaunchDate: new Date().toISOString()
    };
  }

  private saveSettings(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Update last launch date
      this.settings.lastLaunchDate = new Date().toISOString();

      // Write settings
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      logInfo('SettingsManager: Settings saved');
    } catch (error: any) {
      logError(`SettingsManager: Failed to save settings: ${error.message}`);
    }
  }

  // Public methods
  get(key: keyof AppSettings): any {
    return this.settings[key];
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    this.saveSettings();
  }

  getAll(): AppSettings {
    return { ...this.settings };
  }

  setAll(settings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
  }

  isOnboardingCompleted(): boolean {
    return this.settings.onboardingCompleted || false;
  }

  setOnboardingCompleted(completed: boolean): void {
    this.settings.onboardingCompleted = completed;
    this.saveSettings();
  }

  reset(): void {
    this.settings = {
      onboardingCompleted: false,
      firstLaunchDate: new Date().toISOString()
    };
    this.saveSettings();
    logInfo('SettingsManager: Settings reset to defaults');
  }
}

export const settingsManager = SettingsManager.getInstance();