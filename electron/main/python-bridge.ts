import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { logInfo, logError } from './logger';
import fs from 'fs';
import { KashInstaller } from './kash-installer';

export interface PythonProcessResult {
  success: boolean;
  data?: any;
  error?: string;
  needsInstallation?: boolean;
  requiredAction?: string;
  missingAction?: string;
}

export interface KashFileAction {
  action: string;
  files: string[];
  workspace?: string;
  options?: Record<string, any>;
}

export class PythonBridge extends EventEmitter {
  private kashPath: string = '';
  private pythonPath: string = '';
  private scriptPath: string = '';
  private isReady: boolean = false;

  constructor() {
    super();

    // Setup paths for standalone Kash environment
    this.setupKashPaths();
    this.checkKash();
  }

  private setupKashPaths(): void {
    // First check for lazy-loaded Kash environment in user's home
    const installer = new KashInstaller();
    const userKashPath = installer.getKashPath();
    const userPythonPath = installer.getPythonPath();
    
    // Then check for build-time environment (for development)
    const kashEnvPath = app.isPackaged
      ? path.join(process.resourcesPath, 'kash-env')
      : path.join(__dirname, '..', '..', 'resources', 'kash-env');

    // Try to find Kash executable - prioritize user-installed over build-time
    const possibleKashPaths = [
      // User-installed Kash (from py-app-standalone)
      userKashPath,
      // Build-time Kash (if any)
      path.join(kashEnvPath, 'bin', 'kash'),
      path.join(kashEnvPath, 'Scripts', 'kash.exe'),
    ].filter(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    if (possibleKashPaths.length > 0) {
      this.kashPath = possibleKashPaths[0];
      logInfo(`Using standalone Kash: ${this.kashPath}`);
    } else {
      // No Kash found - will need lazy installation
      this.kashPath = '';
      logInfo('Kash not found. Will prompt for installation when needed.');
    }

    // Also keep Python path for fallback (if needed)
    this.pythonPath = fs.existsSync(userPythonPath) ? userPythonPath : '';

    // Path to our ultimate Kash runner with FileStore
    this.scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'kash-ultimate-runner.py')
      : path.join(__dirname, '..', '..', 'resources', 'kash-ultimate-runner.py');
    
    logInfo(`Python script path: ${this.scriptPath}`);
    logInfo(`__dirname: ${__dirname}`);
    
    // Debug: Check if script exists and read first line
    if (fs.existsSync(this.scriptPath)) {
      const firstLine = fs.readFileSync(this.scriptPath, 'utf8').split('\n')[0];
      logInfo(`Script exists. First line: ${firstLine}`);
    } else {
      logError(`Script NOT found at: ${this.scriptPath}`);
    }
  }

  private async checkKash(): Promise<void> {
    if (!this.kashPath) {
      this.isReady = false;
      logInfo('Kash not available. User will be prompted to install on first use.');
      return;
    }

    return new Promise((resolve) => {
      // For macOS, check if Kash executable exists
      if (this.kashPath && fs.existsSync(this.kashPath)) {
        this.isReady = true;
        logInfo('Kash is available');
        resolve();
      } else {
        this.isReady = false;
        logInfo('Kash not installed');
        resolve(); // Don't reject, just mark as not ready
      }
    });
  }

  async processFile(filePath: string, action: string = 'markdownify'): Promise<PythonProcessResult> {
    // Check if Kash is installed
    const installer = new KashInstaller();
    const isInstalled = await installer.isKashInstalled();
    
    if (!isInstalled) {
      return {
        success: false,
        needsInstallation: true,
        requiredAction: action,
        error: 'Document processing features not installed'
      };
    }
    
    // Re-setup paths if needed (in case Kash was just installed)
    if (!this.kashPath || !fs.existsSync(this.kashPath)) {
      this.setupKashPaths();
      await this.checkKash();
    }
    
    if (!this.isReady) {
      await this.checkKash();
    }
    
    // Debug: Check which version of the script we're running
    const versionCheck = spawn(this.pythonPath, [this.scriptPath, '--version']);
    versionCheck.stdout.on('data', (data) => {
      logInfo(`Python script version: ${data.toString().trim()}`);
    });

    return new Promise((resolve, reject) => {
      logInfo(`Processing file with Kash action '${action}': ${filePath}`);
      logInfo(`Using Python: ${this.pythonPath}`);
      logInfo(`Using script: ${this.scriptPath}`);

      const args = [this.scriptPath, filePath, `--action=${action}`];
      // Explicitly separate stdout and stderr
      const python = spawn(this.pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']  // stdin, stdout, stderr as separate pipes
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        // Don't log all stderr as error - Python may use it for warnings
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            logInfo(`Kash action '${action}' succeeded: ${result.output_file || 'Success'}`);
            resolve(result);
          } catch (e) {
            logError(`Failed to parse Kash output: ${e}`);
            resolve({
              success: false,
              error: 'Invalid JSON response from Kash',
              data: stdout
            });
          }
        } else {
          logError(`Kash process failed with code ${code}: ${stderr}`);
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
        }
      });

      python.on('error', (err) => {
        logError(`Failed to spawn Kash process: ${err}`);
        reject(err);
      });
    });
  }

  async processFiles(filePaths: string[], action: string = 'markdownify'): Promise<PythonProcessResult> {
    if (!this.isReady) {
      await this.checkKash();
    }

    if (filePaths.length === 0) {
      return {
        success: false,
        error: 'No files provided'
      };
    }

    return new Promise((resolve, reject) => {
      logInfo(`Processing ${filePaths.length} files with Kash action '${action}'`);

      // Pass all files to kash-runner.py at once
      const args = [this.scriptPath, ...filePaths, `--action=${action}`];
      // Explicitly separate stdout and stderr (same as processFile method)
      const python = spawn(this.pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']  // stdin, stdout, stderr as separate pipes
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        // Don't log all stderr as error - Python may use it for warnings
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            logInfo(`File conversion succeeded`);
            resolve(result);
          } catch (e) {
            logError(`Failed to parse Kash output: ${e}`);
            logError(`First 200 chars of stdout: "${stdout.substring(0, 200)}"`);
            
            // Try to extract JSON even if there's garbage (same recovery as processFile)
            const match = stdout.match(/\{[\s\S]*\}$/);
            if (match) {
              try {
                const result = JSON.parse(match[0]);
                logInfo(`Recovered JSON from mixed output`);
                resolve(result);
                return;
              } catch (e2) {
                logError(`Could not recover JSON: ${e2}`);
              }
            }
            
            resolve({
              success: false,
              error: 'Invalid JSON response from Kash',
              data: stdout
            });
          }
        } else {
          logError(`Kash process failed with code ${code}: ${stderr}`);
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
        }
      });

      python.on('error', (err) => {
        logError(`Failed to spawn Kash process: ${err}`);
        reject(err);
      });
    });
  }

  async runKashAction(action: KashFileAction): Promise<PythonProcessResult> {
    if (action.files.length === 0) {
      return {
        success: false,
        error: 'No files provided'
      };
    }

    logInfo(`Running Kash action '${action.action}' on ${action.files.length} files`);

    try {
      // Process all files with the specified action
      const result = await this.processFiles(action.files, action.action);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Check if Python and required packages are available
  async checkDependencies(): Promise<{
    python: boolean;
    kash: boolean;
    version?: string;
  }> {
    const deps = {
      python: false,
      kash: false,
      version: undefined as string | undefined
    };

    try {
      // Check Python/Kash
      await this.checkKash();
      deps.python = this.pythonPath !== '';
      deps.kash = this.kashPath !== '';

      // Get Python version if available
      if (this.pythonPath) {
        const versionProcess = spawn(this.pythonPath, ['--version']);
        versionProcess.stdout.on('data', (data) => {
          deps.version = data.toString().trim();
        });
      }

      return deps;
    } catch (error) {
      logError(`Dependency check failed: ${error}`);
      return deps;
    }
  }
}

// Singleton instance
export const pythonBridge = new PythonBridge();