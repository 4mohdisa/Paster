import { v4 as uuidv4 } from 'uuid';
import { logError, logInfo } from './logger';
import { convexClient } from './convex-client';

export interface HistoryItem {
  id: string;
  timestamp: string;
  original: string;
  formatted: string;
  format: string;
  source: 'clipboard' | 'manual';
  metadata?: {
    detectedAs: string;
    rowCount?: number;
    columnCount?: number;
  };
}

export class HistoryManager {
  private maxItems: number = 50;

  constructor() {}

  async addItem(
    original: string,
    formatted: string,
    format: string,
    _metadata?: any
  ): Promise<string> {
    const id = uuidv4();

    try {
      await convexClient.addHistoryItem({
        content: original,
        formatted,
        format
      });
      logInfo(`HistoryManager: Added item to Convex`);
    } catch (error) {
      logError(`HistoryManager: Failed to save to Convex - ${error}`);
    }

    return id;
  }

  async getLatest(): Promise<HistoryItem | null> {
    try {
      const history = await convexClient.getHistory(1);
      if (history && history.length > 0) {
        const item = history[0];
        return {
          id: item._id || uuidv4(),
          timestamp: new Date(item.timestamp).toISOString(),
          original: item.content,
          formatted: item.formatted,
          format: item.format,
          source: 'clipboard',
          metadata: {
            detectedAs: item.format || 'table'
          }
        };
      }
    } catch (error) {
      logError(`HistoryManager: Failed to get latest - ${error}`);
    }
    return null;
  }

  async getAll(limit?: number): Promise<HistoryItem[]> {
    try {
      const history = await convexClient.getHistory(limit || this.maxItems);
      if (history) {
        return history.map(item => ({
          id: item._id || uuidv4(),
          timestamp: new Date(item.timestamp).toISOString(),
          original: item.content,
          formatted: item.formatted,
          format: item.format,
          source: 'clipboard' as const,
          metadata: {
            detectedAs: item.format || 'table'
          }
        }));
      }
    } catch (error) {
      logError(`HistoryManager: Failed to get all - ${error}`);
    }
    return [];
  }

  async getById(id: string): Promise<HistoryItem | null> {
    try {
      const history = await convexClient.getHistory(this.maxItems);
      const item = history.find(h => h._id === id);
      if (item) {
        return {
          id: item._id || id,
          timestamp: new Date(item.timestamp).toISOString(),
          original: item.content,
          formatted: item.formatted,
          format: item.format,
          source: 'clipboard',
          metadata: {
            detectedAs: item.format || 'table'
          }
        };
      }
    } catch (error) {
      logError(`HistoryManager: Failed to get by id - ${error}`);
    }
    return null;
  }

  async getByIndex(index: number): Promise<HistoryItem | null> {
    try {
      const history = await convexClient.getHistory(index + 1);
      if (history && history[index]) {
        const item = history[index];
        return {
          id: item._id || uuidv4(),
          timestamp: new Date(item.timestamp).toISOString(),
          original: item.content,
          formatted: item.formatted,
          format: item.format,
          source: 'clipboard',
          metadata: {
            detectedAs: item.format || 'table'
          }
        };
      }
    } catch (error) {
      logError(`HistoryManager: Failed to get by index - ${error}`);
    }
    return null;
  }

  async clear(): Promise<void> {
    try {
      await convexClient.clearHistory();
      logInfo('HistoryManager: Cleared all history in Convex');
    } catch (error) {
      logError(`HistoryManager: Failed to clear Convex history - ${error}`);
    }
  }

  async removeItem(_id: string): Promise<boolean> {
    logInfo(`HistoryManager: Remove item not implemented for Convex yet`);
    return false;
  }

  async getCount(): Promise<number> {
    try {
      const history = await convexClient.getHistory(this.maxItems);
      return history.length;
    } catch (error) {
      logError(`HistoryManager: Failed to get count - ${error}`);
      return 0;
    }
  }

  async hasItems(): Promise<boolean> {
    const count = await this.getCount();
    return count > 0;
  }
}

export const historyManager = new HistoryManager();