import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { logInfo, logError } from './logger';
import fs from 'fs';

export interface PythonProcessResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface KashFileAction {
  action: string;
  files: string[];
  workspace?: string;
  options?: Record<string, any>;
}

export class PythonBridge extends EventEmitter {
  private pythonPath: string = '';
  private scriptPath: string = '';
  private isReady: boolean = false;

  constructor() {
    super();

    // Setup paths for standalone Python environment
    this.setupPythonPaths();
    this.checkPython();
  }

  private setupPythonPaths(): void {
    // Path to kash-env directory
    const kashEnvPath = app.isPackaged
      ? path.join(process.resourcesPath, 'kash-env')
      : path.join(__dirname, '..', '..', 'resources', 'kash-env');

    // Try to find Python executable in standalone environment
    const possiblePythonPaths = [
      path.join(kashEnvPath, 'bin', 'python3'),
      path.join(kashEnvPath, 'bin', 'python'),
      // macOS/Linux with version specifier - only scan if directory exists
      ...(fs.existsSync(kashEnvPath)
        ? fs.readdirSync(kashEnvPath).filter(dir => dir.startsWith('cpython-')).map(dir =>
            path.join(kashEnvPath, dir, 'bin', 'python3')
          )
        : []),
      // Windows
      path.join(kashEnvPath, 'Scripts', 'python.exe'),
    ].filter(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    if (possiblePythonPaths.length > 0) {
      this.pythonPath = possiblePythonPaths[0];
      logInfo(`Using standalone Python: ${this.pythonPath}`);
    } else {
      // No fallback - standalone Python is required
      this.pythonPath = '';
      logError('Standalone Python environment not found. Run "pnpm build:kash" to set it up.');
    }

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

  private async checkPython(): Promise<void> {
    if (!this.pythonPath) {
      this.isReady = false;
      logInfo('bt Run "pnpm build:kash" to enable document conversion.');
      return;
    }

    return new Promise((resolve, reject) => {
      const checkProcess = spawn(this.pythonPath, ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.isReady = true;
          logInfo('Standalone Python is available');
          resolve();
        } else {
          logError('Standalone Python not working properly');
          reject(new Error('Standalone Python environment issue'));
        }
      });

      checkProcess.on('error', (err) => {
        logError(`Standalone Python check failed: ${err}`);
        reject(err);
      });
    });
  }

  async processFile(filePath: string, action: string = 'markdownify'): Promise<PythonProcessResult> {
    if (!this.isReady) {
      await this.checkPython();
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
        // logInfo(`Python stderr: ${data.toString()}`);  // Commenting out to reduce noise
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
      await this.checkPython();
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
        // logInfo(`Python stderr: ${data.toString()}`);  // Commenting out to reduce noise
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
      // Check Python
      await this.checkPython();
      deps.python = true;

      // Get Python version
      const versionProcess = spawn(this.pythonPath, ['--version']);
      versionProcess.stdout.on('data', (data) => {
        deps.version = data.toString().trim();
      });

      // Check for Kash by trying to import it
      const checkKash = spawn(this.pythonPath, ['-c', 'import kash; print("OK")']);

      await new Promise<void>((resolve) => {
        checkKash.on('close', (code) => {
          deps.kash = code === 0;
          resolve();
        });
        checkKash.on('error', () => {
          deps.kash = false;
          resolve();
        });
      });

      return deps;
    } catch (error) {
      logError(`Dependency check failed: ${error}`);
      return deps;
    }
  }
}

// Singleton instance
export const pythonBridge = new PythonBridge();