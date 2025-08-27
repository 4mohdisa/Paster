import { app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { logInfo, logError } from './logger';
import { getRequiredPackages } from './kash-actions-config';

export interface InstallProgress {
  percent: number;
  message: string;
  phase: 'preparing' | 'downloading' | 'installing' | 'configuring' | 'complete' | 'error';
}

export interface InstallResult {
  success: boolean;
  error?: string;
  kashPath?: string;
}

export class KashInstaller {
  private uvPath: string;
  private kashEnvPath: string;
  private pythonVersion = '3.11';

  constructor() {
    // Path to embedded uv binary
    this.uvPath = app.isPackaged
      ? path.join(process.resourcesPath, 'bin', 'uv')
      : path.join(__dirname, '..', '..', 'resources', 'bin', 'uv');

    // Installation directory (user's home)
    const userDataPath = path.join(app.getPath('home'), '.aipaste');
    this.kashEnvPath = path.join(userDataPath, 'kash-env');

    // Create directories if needed
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  }

  /**
   * Check if Kash is installed
   */
  async isKashInstalled(): Promise<boolean> {
    try {
      // Check for Kash executable
      const kashPath = this.getKashPath();
      await fsPromises.access(kashPath);
      return true;
    } catch (error) {
      return false;
    }
  }


  /**
   * Install Kash using py-app-standalone
   */
  async installKash(options: {
    actions?: string[];  // Optional: specific actions to enable
    onProgress?: (progress: InstallProgress) => void;
  }): Promise<InstallResult> {
    const { actions = ['docx_to_markdown'], onProgress } = options;  // Default to DOCX conversion
    
    try {
      // Phase 1: Preparing
      onProgress?.({
        percent: 5,
        message: 'Preparing installation...',
        phase: 'preparing'
      });

      // Check if already installed
      if (await this.isKashInstalled()) {
        logInfo('Kash already installed, skipping base installation');
        
        // Just install the action packages if needed
        const requiredPackages = getRequiredPackages(actions);
        if (requiredPackages.length > 0) {
          await this.installActionPackages(requiredPackages);
        }
        
        await this.saveEnabledActions(actions);
        
        onProgress?.({
          percent: 100,
          message: 'Kash already installed',
          phase: 'complete'
        });
        
        return {
          success: true,
          kashPath: this.getKashPath()
        };
      }

      // Ensure uv is available
      if (!fs.existsSync(this.uvPath)) {
        throw new Error('uv binary not found. Please reinstall the application.');
      }

      // Make uv executable
      fs.chmodSync(this.uvPath, '755');

      // Phase 2: Installing Kash via py-app-standalone
      onProgress?.({
        percent: 20,
        message: 'Installing Kash document processor...',
        phase: 'downloading'
      });

      // Use uvx to run py-app-standalone to install kash-shell
      await this.installKashWithPyApp(onProgress);

      // Phase 3: Install packages for selected actions
      const requiredPackages = getRequiredPackages(actions);
      if (requiredPackages.length > 0) {
        onProgress?.({
          percent: 85,
          message: 'Installing action dependencies...',
          phase: 'configuring'
        });

        await this.installActionPackages(requiredPackages);
      }
      
      // Save enabled actions
      await this.saveEnabledActions(actions);

      // Phase 4: Complete
      onProgress?.({
        percent: 100,
        message: 'Installation complete!',
        phase: 'complete'
      });

      return {
        success: true,
        kashPath: this.getKashPath()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      onProgress?.({
        percent: 0,
        message: errorMessage,
        phase: 'error'
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Install Kash using uvx and py-app-standalone
   */
  private async installKashWithPyApp(onProgress?: (progress: InstallProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use uvx to run py-app-standalone to install kash-shell
      // uvx py-app-standalone --source-only --force --target ~/.aipaste/kash-env --python-version 3.11 kash-shell
      const args = [
        'tool', 'run',
        'py-app-standalone',
        '--source-only',  // Don't create binary, just install the source
        '--force',  // Overwrite if directory exists
        '--target', this.kashEnvPath,
        '--python-version', this.pythonVersion,
        'kash-shell'  // The PyPI package name
      ];

      logInfo(`Installing Kash: ${this.uvPath} ${args.join(' ')}`);

      const childProcess = spawn(this.uvPath, args, {
        env: { ...process.env }
      });
      let stderr = '';
      let stdout = '';
      let allOutput = '';

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        allOutput += output;
        logInfo(`uv stdout: ${output.substring(0, 200)}`);
        
        // Update progress based on output
        if (output.includes('Downloading')) {
          onProgress?.({
            percent: 30,
            message: 'Downloading Kash package...',
            phase: 'downloading'
          });
        } else if (output.includes('Installing')) {
          onProgress?.({
            percent: 60,
            message: 'Installing dependencies...',
            phase: 'installing'
          });
        } else if (output.includes('Creating')) {
          onProgress?.({
            percent: 80,
            message: 'Creating standalone environment...',
            phase: 'configuring'
          });
        }
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        allOutput += output;
        logInfo(`uv stderr: ${output.substring(0, 200)}`);
      });

      childProcess.on('close', async (code) => {
        if (code === 0) {
          logInfo('Kash installed successfully via py-app-standalone');
          logInfo(`Output: ${stdout}`);
          resolve();
        } else if (code === 1 && allOutput.includes('Found') && allOutput.includes('matches')) {
          // Known issue on macOS with _sysconfigdata__darwin_darwin.py
          // The installation is actually complete, just has some absolute paths
          logInfo('Installation completed with known macOS absolute path warnings');
          
          // Check if kash binary exists in cpython directory
          try {
            const entries = fs.readdirSync(this.kashEnvPath);
            const cpythonDir = entries.find(entry => entry.startsWith('cpython-'));
            
            if (cpythonDir) {
              const kashBin = path.join(this.kashEnvPath, cpythonDir, 'bin', 'kash');
              if (fs.existsSync(kashBin)) {
                logInfo('Kash binary found, installation successful despite warnings');
                resolve();
                return;
              }
            }
          } catch (error) {
            logError(`Failed to check for kash binary: ${error}`);
          }
          
          reject(new Error(`Installation failed: Kash binary not found after py-app-standalone`));
        } else {
          const errorMsg = allOutput || `Process exited with code ${code}`;
          logError(`Failed to install Kash with code ${code}`);
          logError(`All output: ${allOutput.substring(0, 500)}`);
          reject(new Error(`Installation failed with code ${code}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Install packages required for selected actions
   */
  public async installActionPackages(packages: string[]): Promise<void> {
    if (packages.length === 0) return;
    
    return new Promise((resolve) => {
      // Install packages using uv pip
      // Find the cpython directory first
      let pythonPath: string;
      try {
        pythonPath = this.getPythonPath();
      } catch (error) {
        logError(`Failed to find Python for package installation: ${error}`);
        resolve(); // Don't block installation
        return;
      }
      
      const args = [
        'pip', 'install',
        '--python', pythonPath,
        '--break-system-packages',  // Allow installing into py-app-standalone environment (NOT system Python)
        ...packages
      ];

      logInfo(`Installing action packages: ${packages.join(', ')}`);
      logInfo(`Using command: ${this.uvPath} ${args.join(' ')}`);

      const installProcess = spawn(this.uvPath, args);
      
      let output = '';
      let errorOutput = '';
      
      installProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      installProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      installProcess.on('close', (code) => {
        if (code === 0) {
          logInfo('Action packages installed successfully');
        } else {
          logError(`Package installation failed with code ${code}`);
          if (output) logError(`Output: ${output}`);
          if (errorOutput) logError(`Error: ${errorOutput}`);
        }
        resolve(); // Always resolve, don't block installation
      });

      installProcess.on('error', (error) => {
        logError(`Error spawning install process: ${error}`);
        resolve();
      });
    });
  }

  /**
   * Save enabled actions to config file
   */
  public async saveEnabledActions(actions: string[]): Promise<void> {
    const configPath = path.join(app.getPath('home'), '.aipaste', 'enabled-actions.json');
    await fsPromises.writeFile(configPath, JSON.stringify({ actions }, null, 2));
  }

  /**
   * Get enabled actions
   */
  async getEnabledActions(): Promise<string[]> {
    try {
      const configPath = path.join(app.getPath('home'), '.aipaste', 'enabled-actions.json');
      const data = await fsPromises.readFile(configPath, 'utf8');
      const config = JSON.parse(data);
      return config.actions || [];
    } catch {
      return ['docx_to_markdown'];  // Default action
    }
  }

  /**
   * Get path to Python executable (macOS only)
   */
  public getPythonPath(): string {
    // py-app-standalone creates a cpython-* directory
    try {
      const entries = fs.readdirSync(this.kashEnvPath);
      const cpythonDir = entries.find(entry => entry.startsWith('cpython-'));
      
      if (!cpythonDir) {
        throw new Error('No cpython directory found in kash-env');
      }
      
      const pythonPath = path.join(this.kashEnvPath, cpythonDir, 'bin', 'python');
      if (!fs.existsSync(pythonPath)) {
        throw new Error(`Python binary not found at ${pythonPath}`);
      }
      
      return pythonPath;
    } catch (error) {
      throw new Error(`Failed to find Python: ${error}`);
    }
  }

  /**
   * Get path to Kash executable (macOS only)
   */
  public getKashPath(): string {
    // py-app-standalone creates a cpython-* directory
    try {
      const entries = fs.readdirSync(this.kashEnvPath);
      const cpythonDir = entries.find(entry => entry.startsWith('cpython-'));
      
      if (!cpythonDir) {
        throw new Error('No cpython directory found in kash-env');
      }
      
      const kashPath = path.join(this.kashEnvPath, cpythonDir, 'bin', 'kash');
      if (!fs.existsSync(kashPath)) {
        throw new Error(`Kash binary not found at ${kashPath}`);
      }
      
      return kashPath;
    } catch (error) {
      throw new Error(`Failed to find Kash: ${error}`);
    }
  }

  /**
   * Uninstall Kash (remove environment)
   */
  async uninstallKash(): Promise<boolean> {
    try {
      await fsPromises.rm(this.kashEnvPath, { recursive: true, force: true });
      logInfo('Kash uninstalled successfully');
      return true;
    } catch (error) {
      logError(`Failed to uninstall Kash: ${error}`);
      return false;
    }
  }

}