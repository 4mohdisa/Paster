import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { pathConfig } from './config/paths';
import { logInfo, logError } from './logger';

/**
 * Manages Convex client connection for the Electron backend
 */
export class ConvexClientManager {
  private static instance: ConvexClientManager;
  private client: ConvexHttpClient | null = null;
  
  private constructor() {}
  
  static getInstance(): ConvexClientManager {
    if (!ConvexClientManager.instance) {
      ConvexClientManager.instance = new ConvexClientManager();
    }
    return ConvexClientManager.instance;
  }
  
  /**
   * Initialize the Convex client with backend URL
   */
  initialize(url?: string): void {
    const convexUrl = url || pathConfig.getConvexConfig().backendUrl;
    logInfo(`ConvexClient: Initializing with URL: ${convexUrl}`);
    
    try {
      this.client = new ConvexHttpClient(convexUrl);
      logInfo('ConvexClient: Initialized successfully');
    } catch (error: any) {
      logError(`ConvexClient: Failed to initialize: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get the Convex client instance
   */
  getClient(): ConvexHttpClient {
    if (!this.client) {
      // Auto-initialize with default URL
      this.initialize();
    }
    return this.client!;
  }
  
  /**
   * Add clipboard history entry to Convex
   */
  async addHistoryItem(item: {
    content: string;
    formatted: string;
    format: string;
  }): Promise<void> {
    try {
      const client = this.getClient();
      await client.mutation(api.clipboardHistory.add, {
        content: item.content,
        formatted: item.formatted,
        format: item.format,
      });
      logInfo('ConvexClient: Added history item to Convex');
    } catch (error: any) {
      logError(`ConvexClient: Failed to add history item: ${error.message}`);
      // Don't throw - allow app to continue working offline
    }
  }
  
  /**
   * Get clipboard history from Convex
   */
  async getHistory(limit: number = 50): Promise<any[]> {
    try {
      const client = this.getClient();
      const history = await client.query(api.clipboardHistory.list, {
        limit,
      });
      return history || [];
    } catch (error: any) {
      logError(`ConvexClient: Failed to get history: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Clear clipboard history in Convex
   */
  async clearHistory(): Promise<void> {
    try {
      const client = this.getClient();
      await client.mutation(api.clipboardHistory.clear, {});
      logInfo('ConvexClient: Cleared history in Convex');
    } catch (error: any) {
      logError(`ConvexClient: Failed to clear history: ${error.message}`);
    }
  }
  
  /**
   * Sync settings to Convex
   */
  async syncSettings(settings: Record<string, any>): Promise<void> {
    try {
      const client = this.getClient();
      await client.mutation(api.settings.sync, {
        settings,
      });
      logInfo('ConvexClient: Synced settings to Convex');
    } catch (error: any) {
      logError(`ConvexClient: Failed to sync settings: ${error.message}`);
    }
  }
  
  /**
   * Get settings from Convex
   */
  async getSettings(): Promise<Record<string, any>> {
    try {
      const client = this.getClient();
      const settings = await client.query(api.settings.getAll);
      return settings || {};
    } catch (error: any) {
      logError(`ConvexClient: Failed to get settings: ${error.message}`);
      return {};
    }
  }
}

// Export singleton instance
export const convexClient = ConvexClientManager.getInstance();