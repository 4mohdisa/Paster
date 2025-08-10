import { ChildProcess, execFile, spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';
import { promisify } from 'util';
import { logError, logInfo } from './logger';

const execFileAsync = promisify(execFile);

interface CLIResponse {
  success: boolean;
  message?: string;
  data?: string;
  error?: string;
}

export class SwiftBridge {
  private binaryPath: string;
  private monitorProcess: ChildProcess | null = null;

  constructor() {
    // Determine binary path based on environment
    const isDev = !app.isPackaged;
    this.binaryPath = isDev
      ? path.join(app.getAppPath(), 'swift-cli', '.build', 'debug', 'AiPasteHelper')
      : path.join(process.resourcesPath, 'bin', 'AiPasteHelper');

    logInfo(`Swift binary path: ${this.binaryPath}`);
  }

  /**
   * Test if the Swift CLI is working
   */
  async test(): Promise<boolean> {
    try {
      const result = await this.execute(['test']);
      return result.success;
    } catch (error) {
      logError(`Swift CLI test failed: ${error}`);
      return false;
    }
  }

  /**
   * Format table data with pipe delimiters
   */
  async formatTable(input: string, format: 'simple' | 'markdown' | 'html' = 'simple'): Promise<string> {
    try {
      const result = await this.execute(['format', '--input', input, '-o', format]);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || 'Format failed');
    } catch (error) {
      logError(`Table formatting failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute complete paste flow (format + update clipboard + trigger Cmd+V)
   */
  async executePaste(options?: { noPrefix?: boolean; simulate?: boolean }): Promise<boolean> {
    try {
      const args = ['paste'];
      if (options?.noPrefix) args.push('--no-prefix');
      if (options?.simulate) args.push('--simulate');

      const result = await this.execute(args);
      if (result.success) {
        logInfo('Paste executed successfully');
        return true;
      }
      logError(`Paste failed: ${result.error}`);
      return false;
    } catch (error) {
      logError(`Paste execution failed: ${error}`);
      return false;
    }
  }

  /**
   * Trigger system paste (Cmd+V) without formatting
   */
  async triggerSystemPaste(): Promise<boolean> {
    try {
      const result = await this.execute(['trigger-paste']);
      if (result.success) {
        logInfo('System paste triggered successfully');
        return true;
      }
      logError(`System paste failed: ${result.error}`);
      return false;
    } catch (error) {
      logError(`System paste failed: ${error}`);
      return false;
    }
  }

  /**
   * Start clipboard monitoring (long-running process)
   */
  startClipboardMonitor(callback: (data: string) => void): void {
    if (this.monitorProcess) {
      this.stopClipboardMonitor();
    }

    logInfo('Starting clipboard monitor...');
    this.monitorProcess = spawn(this.binaryPath, ['monitor']);

    this.monitorProcess.stdout?.on('data', (data: Buffer) => {
      try {
        const response: CLIResponse = JSON.parse(data.toString());
        if (response.success && response.data) {
          callback(response.data);
        }
      } catch (error) {
        // Handle non-JSON output (like status messages)
        const output = data.toString().trim();
        if (output) {
          logInfo(`Monitor output: ${output}`);
        }
      }
    });

    this.monitorProcess.stderr?.on('data', (data: Buffer) => {
      logError(`Monitor error: ${data.toString()}`);
    });

    this.monitorProcess.on('close', (code) => {
      logInfo(`Monitor process exited with code ${code}`);
      this.monitorProcess = null;
    });
  }

  /**
   * Stop clipboard monitoring
   */
  stopClipboardMonitor(): void {
    if (this.monitorProcess) {
      logInfo('Stopping clipboard monitor...');
      this.monitorProcess.kill();
      this.monitorProcess = null;
    }
  }

  /**
   * Get current settings
   */
  async getSettings(): Promise<any> {
    try {
      const result = await this.execute(['settings', 'get']);
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      throw new Error(result.error || 'Failed to get settings');
    } catch (error) {
      logError(`Failed to get settings: ${error}`);
      throw error;
    }
  }

  /**
   * Update settings using bulk update command
   */
  async updateSettings(settings: any): Promise<boolean> {
    try {
      const result = await this.execute(['settings', 'update', '--json', JSON.stringify(settings)]);
      return result.success;
    } catch (error) {
      logError(`Failed to update settings: ${error}`);
      return false;
    }
  }

  /**
   * Execute a one-shot command
   */
  private async execute(args: string[]): Promise<CLIResponse> {
    try {
      const { stdout, stderr } = await execFileAsync(this.binaryPath, args);

      if (stderr) {
        logError(`Swift CLI stderr: ${stderr}`);
      }

      // Parse JSON response
      const response: CLIResponse = JSON.parse(stdout);
      return response;
    } catch (error: any) {
      // Handle execution errors
      if (error.code === 'ENOENT') {
        throw new Error(`Swift CLI not found at ${this.binaryPath}`);
      }

      // Try to parse error output as JSON
      if (error.stdout) {
        try {
          const response: CLIResponse = JSON.parse(error.stdout);
          return response;
        } catch {
          // Not JSON, return as error
        }
      }

      throw new Error(`Swift CLI error: ${error.message}`);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopClipboardMonitor();
  }
}

// Singleton instance
export const swiftBridge = new SwiftBridge();