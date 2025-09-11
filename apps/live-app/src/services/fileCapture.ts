import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

export interface CapturedFileInfo {
  originalPath: string;
  savedPath: string;
  name: string;
  extension: string;
  size: number;
  type: 'file' | 'directory';
  capturedAt: string;
  hash: string;
}

export interface FileCaptureStatus {
  fileId: string;
  originalPath: string;
  status: 'processing' | 'completed' | 'error' | 'skipped';
  savedPath?: string;
  error?: string;
  capturedAt: string;
  lastUpdated: string;
}

/**
 * Service for handling captured file processing and storage
 */
export class FileCaptureService {
  private baseDir: string;
  private statusFile: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.neutralbase');
    this.statusFile = path.join(this.baseDir, 'captured_files_status.json');
    this.ensureBaseDir();
  }

  // baseDir is fixed to the user's home directory under .neutralbase

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Generate a unique file ID based on path and timestamp
   */
  private generateFileId(originalPath: string): string {
    const timestamp = Date.now().toString();
    const pathHash = crypto.createHash('md5').update(originalPath).digest('hex').substring(0, 8);
    return `file_${pathHash}_${timestamp}`;
  }

  /**
   * Clean filename for safe storage
   */
  private cleanFilename(filename: string): string {
    return filename.replace(/[/\\?%*:|"<>]/g, '_');
  }

  /**
   * Load captured files status
   */
  private loadCapturedFilesStatus(): FileCaptureStatus[] {
    try {
      if (fs.existsSync(this.statusFile)) {
        const data = fs.readFileSync(this.statusFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading captured files status:', error);
    }
    return [];
  }

  /**
   * Save captured files status
   */
  private saveCapturedFilesStatus(statuses: FileCaptureStatus[]): void {
    try {
      const statusJson = JSON.stringify(statuses, null, 2);
      fs.writeFileSync(this.statusFile, statusJson);
    } catch (error) {
      console.error('Error saving captured files status:', error);
    }
  }

  /**
   * Update file status
   */
  private updateFileStatus(
    statuses: FileCaptureStatus[],
    fileId: string,
    status: 'processing' | 'completed' | 'error' | 'skipped',
    savedPath?: string,
    error?: string,
  ): void {
    const fileStatus = statuses.find(s => s.fileId === fileId);
    if (fileStatus) {
      fileStatus.status = status;
      fileStatus.lastUpdated = new Date().toISOString();
      if (savedPath) fileStatus.savedPath = savedPath;
      if (error) fileStatus.error = error;
    }
  }

  /**
   * Copy file to downloads directory
   */
  private async copyFileToDownloads(originalPath: string, fileId: string, filename: string): Promise<string> {
    const cleanFilename = this.cleanFilename(filename);
    const savedPath = path.join(this.baseDir, `${fileId}_${cleanFilename}`);
    
    try {
      // Copy the file
      await fs.promises.copyFile(originalPath, savedPath);
      return savedPath;
    } catch (error) {
      console.error(`Error copying file ${originalPath}:`, error);
      throw error;
    }
  }

  /**
   * Create directory in downloads
   */
  private async createDirectoryInDownloads(originalPath: string, fileId: string, dirname: string): Promise<string> {
    const cleanDirname = this.cleanFilename(dirname);
    const savedPath = path.join(this.baseDir, `${fileId}_${cleanDirname}`);
    
    try {
      // Create the directory
      await fs.promises.mkdir(savedPath, { recursive: true });
      return savedPath;
    } catch (error) {
      console.error(`Error creating directory ${originalPath}:`, error);
      throw error;
    }
  }

  /**
   * Calculate file hash for deduplication
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.promises.readFile(filePath);
      return crypto.createHash('md5').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error(`Error calculating hash for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Check if file already exists (by hash)
   */
  private async checkFileExists(filePath: string): Promise<string | null> {
    try {
      const fileHash = await this.calculateFileHash(filePath);
      const statuses = this.loadCapturedFilesStatus();
      
      const existingFile = statuses.find(s => 
        s.status === 'completed' && 
        s.savedPath && 
        fs.existsSync(s.savedPath),
      );
      
      if (existingFile && existingFile.savedPath) {
        const existingHash = await this.calculateFileHash(existingFile.savedPath);
        if (existingHash === fileHash) {
          return existingFile.savedPath;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return null;
    }
  }

  /**
   * Process captured files
   */
  async processCapturedFiles(files: Array<{ path: string; name: string; extension: string; size?: number; type: 'file' | 'directory' }>): Promise<CapturedFileInfo[]> {
    console.log(`📁 [FILE CAPTURE] Processing ${files.length} captured files...`);
    
    const statuses = this.loadCapturedFilesStatus();
    const results: CapturedFileInfo[] = [];

    for (const file of files) {
      const fileId = this.generateFileId(file.path);
      const capturedAt = new Date().toISOString();
      
      console.log(`📁 [FILE CAPTURE] Processing: ${file.name}${file.extension} (${file.type})`);

      // Check if file already exists
      const existingPath = await this.checkFileExists(file.path);
      if (existingPath) {
        console.log(`📁 [FILE CAPTURE] File already exists, skipping: ${file.name}${file.extension}`);
        this.updateFileStatus(statuses, fileId, 'skipped', existingPath);
        
        results.push({
          originalPath: file.path,
          savedPath: existingPath,
          name: file.name,
          extension: file.extension,
          size: file.size || 0,
          type: file.type,
          capturedAt,
          hash: await this.calculateFileHash(file.path),
        });
        continue;
      }

      // Update status to processing
      statuses.push({
        fileId,
        originalPath: file.path,
        status: 'processing',
        capturedAt,
        lastUpdated: capturedAt,
      });
      this.saveCapturedFilesStatus(statuses);

      try {
        let savedPath: string;
        
        if (file.type === 'file') {
          // Copy file to downloads
          savedPath = await this.copyFileToDownloads(file.path, fileId, `${file.name}${file.extension}`);
        } else {
          // Create directory in downloads
          savedPath = await this.createDirectoryInDownloads(file.path, fileId, file.name);
        }

        // Update status to completed
        this.updateFileStatus(statuses, fileId, 'completed', savedPath);
        this.saveCapturedFilesStatus(statuses);

        const fileHash = await this.calculateFileHash(file.path);
        
        results.push({
          originalPath: file.path,
          savedPath,
          name: file.name,
          extension: file.extension,
          size: file.size || 0,
          type: file.type,
          capturedAt,
          hash: fileHash,
        });

        console.log(`📁 [FILE CAPTURE] Successfully saved: ${file.name}${file.extension} to ${savedPath}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`📁 [FILE CAPTURE] Error processing ${file.name}${file.extension}:`, errorMessage);
        
        this.updateFileStatus(statuses, fileId, 'error', undefined, errorMessage);
        this.saveCapturedFilesStatus(statuses);
      }
    }

    return results;
  }

  /**
   * Get captured file info
   */
  getCapturedFileInfo(fileId: string): CapturedFileInfo | null {
    const statuses = this.loadCapturedFilesStatus();
    const status = statuses.find(s => s.fileId === fileId);
    
    if (!status || status.status !== 'completed' || !status.savedPath) {
      return null;
    }

    try {
      const stats = fs.statSync(status.savedPath);
      const parsedPath = path.parse(status.savedPath);
      
      return {
        originalPath: status.originalPath,
        savedPath: status.savedPath,
        name: parsedPath.name,
        extension: parsedPath.ext,
        size: stats.size,
        type: stats.isDirectory() ? 'directory' : 'file',
        capturedAt: status.capturedAt,
        hash: '', // Would need to calculate this if needed
      };
    } catch (error) {
      console.error(`Error getting file info for ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Get all captured files
   */
  getAllCapturedFiles(): CapturedFileInfo[] {
    const statuses = this.loadCapturedFilesStatus();
    const results: CapturedFileInfo[] = [];
    
    for (const status of statuses) {
      if (status.status === 'completed' && status.savedPath) {
        const fileInfo = this.getCapturedFileInfo(status.fileId);
        if (fileInfo) {
          results.push(fileInfo);
        }
      }
    }
    
    return results;
  }

  /**
   * Delete captured file
   */
  async deleteCapturedFile(fileId: string): Promise<boolean> {
    const statuses = this.loadCapturedFilesStatus();
    const status = statuses.find(s => s.fileId === fileId);
    
    if (!status || !status.savedPath) {
      return false;
    }

    try {
      if (fs.existsSync(status.savedPath)) {
        const stats = fs.statSync(status.savedPath);
        if (stats.isDirectory()) {
          await fs.promises.rmdir(status.savedPath, { recursive: true });
        } else {
          await fs.promises.unlink(status.savedPath);
        }
      }
      
      // Remove from status
      const updatedStatuses = statuses.filter(s => s.fileId !== fileId);
      this.saveCapturedFilesStatus(updatedStatuses);
      
      return true;
    } catch (error) {
      console.error(`Error deleting captured file ${fileId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const fileCaptureService = new FileCaptureService(); 