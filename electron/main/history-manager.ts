import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logError, logInfo } from './logger';

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

interface HistoryStorage {
  items: HistoryItem[];
  maxItems: number;
  version: string;
}

export class HistoryManager {
  private historyFile: string;
  private maxItems: number = 50;
  private cache: HistoryItem[] = [];
  private initialized: boolean = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.historyFile = path.join(userDataPath, 'clipboard-history.json');
    this.initialize();
  }

  private async initialize() {
    try {
      await this.loadFromFile();
      this.initialized = true;
      logInfo(`HistoryManager: Loaded ${this.cache.length} items from history`);
    } catch (error) {
      logError(`HistoryManager: Failed to initialize - ${error}`);
      this.cache = [];
      this.initialized = true;
    }
  }

  async addItem(
    original: string,
    formatted: string,
    format: string,
    metadata?: any
  ): Promise<string> {
    const item: HistoryItem = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      original,
      formatted,
      format,
      source: 'clipboard',
      metadata
    };

    // Add to beginning of array (most recent first)
    this.cache.unshift(item);

    // Trim to max items
    if (this.cache.length > this.maxItems) {
      this.cache = this.cache.slice(0, this.maxItems);
    }

    // Save to file
    await this.saveToFile();

    logInfo(`HistoryManager: Added item ${item.id} to history`);
    return item.id;
  }

  async getLatest(): Promise<HistoryItem | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.cache.length > 0 ? this.cache[0] : null;
  }

  async getAll(limit?: number): Promise<HistoryItem[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (limit && limit > 0) {
      return this.cache.slice(0, limit);
    }
    return this.cache;
  }

  async getById(id: string): Promise<HistoryItem | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.cache.find(item => item.id === id) || null;
  }

  async getByIndex(index: number): Promise<HistoryItem | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (index >= 0 && index < this.cache.length) {
      return this.cache[index];
    }
    return null;
  }

  async clear(): Promise<void> {
    this.cache = [];
    await this.saveToFile();
    logInfo('HistoryManager: Cleared all history');
  }

  async removeItem(id: string): Promise<boolean> {
    const index = this.cache.findIndex(item => item.id === id);
    if (index !== -1) {
      this.cache.splice(index, 1);
      await this.saveToFile();
      logInfo(`HistoryManager: Removed item ${id}`);
      return true;
    }
    return false;
  }

  private async saveToFile(): Promise<void> {
    try {
      const storage: HistoryStorage = {
        items: this.cache,
        maxItems: this.maxItems,
        version: '1.0.0'
      };

      const dir = path.dirname(this.historyFile);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.historyFile,
        JSON.stringify(storage, null, 2),
        'utf-8'
      );
    } catch (error) {
      logError(`HistoryManager: Failed to save history - ${error}`);
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      const storage: HistoryStorage = JSON.parse(data);
      
      // Validate version and structure
      if (storage.version === '1.0.0' && Array.isArray(storage.items)) {
        this.cache = storage.items;
        this.maxItems = storage.maxItems || 50;
      } else {
        // Invalid format, start fresh
        this.cache = [];
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, that's okay
        this.cache = [];
      } else {
        throw error;
      }
    }
  }

  // Get count of items
  getCount(): number {
    return this.cache.length;
  }

  // Check if history has items
  hasItems(): boolean {
    return this.cache.length > 0;
  }
}

// Singleton instance
export const historyManager = new HistoryManager();