import { app } from 'electron';
import path from 'path';

/**
 * Centralized path configuration for the application
 * Follows Dependency Inversion Principle - depend on abstractions not concrete paths
 */
export class PathConfig {
  private static instance: PathConfig;
  private readonly isDev: boolean;
  
  private constructor() {
    this.isDev = !app.isPackaged;
  }
  
  static getInstance(): PathConfig {
    if (!PathConfig.instance) {
      PathConfig.instance = new PathConfig();
    }
    return PathConfig.instance;
  }
  
  /**
   * Get the Swift CLI binary path based on environment
   */
  getSwiftBinaryPath(): string {
    if (this.isDev) {
      // In development, use absolute path from __dirname
      // __dirname is electron/main/config, so go up 3 levels to monorepo root
      return path.join(
        __dirname,
        '..',
        '..',
        '..',
        'native',
        'swift-cli',
        '.build',
        'debug',
        'AiPasteHelper'
      );
    }
    
    // In production, binary is bundled in resources
    return path.join(process.resourcesPath, 'bin', 'AiPasteHelper');
  }
  
  /**
   * Get the main window app path
   */
  getMainWindowPath(): string {
    if (this.isDev) {
      return 'http://localhost:3000';
    }
    
    // In production, Next.js app is bundled
    return path.join(app.getAppPath(), 'app', 'main-window');
  }
  
  /**
   * Get resources directory path
   */
  getResourcesPath(): string {
    if (this.isDev) {
      return path.join(app.getAppPath(), 'resources');
    }
    
    return process.resourcesPath;
  }
  
  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.isDev;
  }
  
  /**
   * Get the Convex backend binary path based on environment
   */
  getConvexBinaryPath(): string {
    const platform = process.platform;
    const arch = process.arch;
    const binaryName = platform === 'win32' ? 'convex-local-backend.exe' : 'convex-local-backend';
    
    if (this.isDev) {
      // In development, binary should be in electron/resources/bin/<platform>-<arch>/
      return path.join(
        __dirname,
        '..',
        '..',
        'resources',
        'bin',
        `${platform}-${arch}`,
        binaryName
      );
    }
    
    // In production, binary is bundled in resources
    return path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, binaryName);
  }
  
  /**
   * Get the Convex data directory path
   * Uses unique subdirectory to avoid conflicts with other Convex installations
   */
  getConvexDataDir(): string {
    return path.join(app.getPath('userData'), 'aipaste-convex-db');
  }
  
  /**
   * Get Convex backend configuration
   * Using unique port range 52100-52101 to avoid conflicts
   */
  getConvexConfig(): { backendPort: number; actionsPort: number; backendUrl: string; actionsUrl: string } {
    const backendPort = 52100;
    const actionsPort = 52101;
    return {
      backendPort,
      actionsPort,
      backendUrl: `http://127.0.0.1:${backendPort}`,
      actionsUrl: `http://127.0.0.1:${actionsPort}`
    };
  }
}

// Export singleton instance
export const pathConfig = PathConfig.getInstance();