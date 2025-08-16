import { ChildProcess, spawn } from 'child_process';
import { app, systemPreferences } from 'electron';
import { EventEmitter } from 'events';
import { pathConfig } from './config/paths';
import { logError, logInfo, logDebug } from './logger';
import { historyManager } from './history-manager';

interface ManagedProcess {
  name: string;
  process: ChildProcess | null;
  command: string;
  args: string[];
  restartAttempts: number;
  maxRestarts: number;
  restartDelay: number;
  isRunning: boolean;
  shouldRestart: boolean;
  lastStartTime: number;
  heartbeatInterval?: NodeJS.Timeout;
}

interface CLIResponse {
  success: boolean;
  message?: string;
  data?: string;
  error?: string;
  event?: string;
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ManagedProcess> = new Map();
  private isShuttingDown: boolean = false;
  private binaryPath: string;

  constructor() {
    super();
    
    // Use centralized path configuration
    this.binaryPath = pathConfig.getSwiftBinaryPath();
    logInfo(`ProcessManager: Swift binary path: ${this.binaryPath}`);

    // Handle app shutdown
    app.on('before-quit', () => {
      this.shutdown();
    });

    // Handle process termination signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Check system permissions using Electron API
   */
  checkPermissions(): { accessibility: boolean } {
    // Use Electron's native API to check accessibility permission
    const accessibility = systemPreferences.isTrustedAccessibilityClient(false);
    logInfo(`Permissions check - Accessibility: ${accessibility}`);
    return { accessibility };
  }

  /**
   * Start the clipboard monitor daemon
   */
  async startClipboardMonitor(): Promise<boolean> {
    logInfo('ProcessManager: Starting clipboard monitor...');
    
    // Check permissions first using Electron API
    const permissions = this.checkPermissions();
    if (!permissions.accessibility) {
      logError('ProcessManager: Cannot start clipboard monitor - accessibility permission not granted');
      
      // Request permission using Electron's API
      logInfo('ProcessManager: Requesting accessibility permission...');
      systemPreferences.isTrustedAccessibilityClient(true); // This prompts the user
      
      this.emit('permission-required', {
        type: 'accessibility',
        message: 'Please grant accessibility permission to monitor clipboard'
      });
      
      // Start polling for permission grant
      this.startPermissionPolling();
      return false;
    }
    
    // Start the monitor daemon
    const config: ManagedProcess = {
      name: 'clipboard-monitor',
      process: null,
      command: this.binaryPath,
      args: ['monitor'],
      restartAttempts: 0,
      maxRestarts: 5,
      restartDelay: 1000,
      isRunning: false,
      shouldRestart: true,
      lastStartTime: Date.now()
    };
    
    this.processes.set('clipboard-monitor', config);
    return this.startProcess('clipboard-monitor');
  }

  /**
   * Start the shortcuts daemon process
   */
  async startShortcutsDaemon(): Promise<boolean> {
    logInfo('ProcessManager: Starting shortcuts daemon...');
    
    // Check permissions first using Electron API
    const permissions = this.checkPermissions();
    if (!permissions.accessibility) {
      logError('ProcessManager: Cannot start shortcuts daemon - accessibility permission not granted');
      
      // Request permission using Electron's API
      logInfo('ProcessManager: Requesting accessibility permission...');
      systemPreferences.isTrustedAccessibilityClient(true); // This prompts the user
      
      this.emit('permission-required', {
        type: 'accessibility',
        message: 'Please grant accessibility permission to use keyboard shortcuts'
      });
      
      // Start polling for permission grant
      this.startPermissionPolling();
      return false;
    }
    
    const processConfig: ManagedProcess = {
      name: 'shortcuts-daemon',
      process: null,
      command: this.binaryPath,
      args: ['shortcuts'],
      restartAttempts: 0,
      maxRestarts: 5,
      restartDelay: 1000, // Start with 1 second delay
      isRunning: false,
      shouldRestart: true,
      lastStartTime: Date.now()
    };

    this.processes.set('shortcuts-daemon', processConfig);
    return this.startProcess('shortcuts-daemon');
  }

  /**
   * Poll for permission grant and auto-start daemon
   */
  private startPermissionPolling(): void {
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 60 seconds
    
    const pollInterval = setInterval(() => {
      pollCount++;
      const permissions = this.checkPermissions();
      
      if (permissions.accessibility) {
        clearInterval(pollInterval);
        logInfo('ProcessManager: Permission granted! Starting shortcuts daemon...');
        this.emit('permission-granted', { type: 'accessibility' });
        
        // Permission granted, start the daemon
        this.startShortcutsDaemon();
      } else if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        logInfo('ProcessManager: Stopped polling for permission (timeout)');
      }
    }, 1000); // Check every second
  }

  /**
   * Start a managed process
   */
  private async startProcess(processName: string): Promise<boolean> {
    const config = this.processes.get(processName);
    if (!config) {
      logError(`ProcessManager: Process ${processName} not found`);
      return false;
    }

    // Don't start if shutting down
    if (this.isShuttingDown) {
      logInfo(`ProcessManager: Skipping start of ${processName} - shutting down`);
      return false;
    }

    // Check if already running
    if (config.isRunning && config.process) {
      logInfo(`ProcessManager: ${processName} is already running`);
      return true;
    }

    try {
      logInfo(`ProcessManager: Spawning ${processName}...`);
      
      const childProcess = spawn(config.command, config.args, {
        detached: false, // Keep attached for automatic cleanup
        stdio: ['ignore', 'pipe', 'pipe']
      });

      config.process = childProcess;
      config.isRunning = true;
      config.lastStartTime = Date.now();

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          try {
            const response: CLIResponse = JSON.parse(output);
            this.handleProcessMessage(processName, response);
          } catch {
            // Not JSON, just log it
            logDebug(`${processName}: ${output}`);
          }
        }
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        logError(`${processName} error: ${data.toString()}`);
      });

      // Handle process exit
      childProcess.on('exit', (code, signal) => {
        logInfo(`${processName} exited with code ${code}, signal ${signal}`);
        config.isRunning = false;
        config.process = null;

        // Clear heartbeat if exists
        if (config.heartbeatInterval) {
          clearInterval(config.heartbeatInterval);
          config.heartbeatInterval = undefined;
        }

        // Handle restart logic
        if (!this.isShuttingDown && config.shouldRestart) {
          this.handleProcessRestart(processName);
        }
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        logError(`${processName} process error: ${error.message}`);
        config.isRunning = false;
        config.process = null;
      });

      // Start heartbeat monitoring for shortcuts daemon
      if (processName === 'shortcuts-daemon') {
        this.startHeartbeatMonitoring(processName);
      }

      logInfo(`ProcessManager: ${processName} started successfully`);
      return true;

    } catch (error: any) {
      logError(`ProcessManager: Failed to start ${processName}: ${error.message}`);
      config.isRunning = false;
      config.process = null;
      return false;
    }
  }

  /**
   * Handle messages from managed processes
   */
  private async handleProcessMessage(processName: string, response: CLIResponse) {
    // Check for permission errors first
    if (!response.success && response.error?.includes('permission')) {
      logError(`${processName}: Permission error - ${response.error}`);
      
      // Stop trying to restart if permission denied
      const config = this.processes.get(processName);
      if (config) {
        config.shouldRestart = false;
        logInfo(`${processName}: Disabled auto-restart due to permission error`);
        
        // Emit event to UI to show permission request dialog
        this.emit('permission-required', { 
          process: processName, 
          type: 'accessibility',
          error: response.error 
        });
      }
      return;
    }
    
    // Handle clipboard change from monitor
    if (response.event === 'clipboard-change' && response.data) {
      logInfo('Clipboard change detected - storing in history');
      
      // Parse JSON data from Swift
      let clipboardData: any;
      try {
        clipboardData = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data;
      } catch (error) {
        logError(`Failed to parse clipboard data: ${error}`);
        return;
      }
      
      // Extract data from response
      const { original, formatted, metadata } = clipboardData;
      
      // Store in history
      const historyId = await historyManager.addItem(
        original,
        formatted,
        metadata?.format || 'simple',
        metadata
      );
      
      // Notify all windows about the new history item
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        window.webContents.send('history-item-added', {
          id: historyId,
          original,
          formatted,
          format: metadata?.format || 'simple',
          metadata,
          timestamp: new Date().toISOString()
        });
      });
      
      // Also emit event for other listeners
      this.emit('clipboard-formatted', {
        id: historyId,
        original,
        formatted,
        metadata,
        timestamp: new Date().toISOString()
      });
    }
    // Handle shortcut trigger - now paste from history
    else if (response.event === 'shortcut-triggered') {
      logInfo(`Shortcut triggered - pasting from history`);
      
      // Get latest item from history
      const latestItem = await historyManager.getLatest();
      if (latestItem) {
        // Emit event with history item
        this.emit('shortcut-triggered', {
          message: 'Pasting from history',
          historyItem: latestItem,
          timestamp: new Date().toISOString()
        });
      } else {
        logInfo('No history items available to paste');
      }
    } else if (response.event === 'key-debug') {
      logDebug(`Key event: ${response.data}`);
    } else if (!response.success) {
      logError(`${processName}: Error - ${response.error || response.message}`);
    } else {
      logDebug(`${processName}: ${JSON.stringify(response)}`);
    }
  }

  /**
   * Handle process restart with exponential backoff
   */
  private async handleProcessRestart(processName: string) {
    const config = this.processes.get(processName);
    if (!config) return;

    // Check if we've exceeded max restarts
    if (config.restartAttempts >= config.maxRestarts) {
      logError(`ProcessManager: ${processName} exceeded max restarts (${config.maxRestarts})`);
      
      // Reset counter after 5 minutes
      setTimeout(() => {
        if (config) {
          config.restartAttempts = 0;
          logInfo(`ProcessManager: Reset restart counter for ${processName}`);
        }
      }, 5 * 60 * 1000);
      
      return;
    }

    // Check if process crashed too quickly (within 5 seconds)
    const crashTime = Date.now() - config.lastStartTime;
    if (crashTime < 5000) {
      config.restartDelay = Math.min(config.restartDelay * 2, 30000); // Max 30 seconds
    } else {
      config.restartDelay = 1000; // Reset to 1 second
    }

    config.restartAttempts++;
    logInfo(`ProcessManager: Restarting ${processName} in ${config.restartDelay}ms (attempt ${config.restartAttempts}/${config.maxRestarts})`);

    setTimeout(() => {
      if (!this.isShuttingDown && config.shouldRestart) {
        this.startProcess(processName);
      }
    }, config.restartDelay);
  }

  /**
   * Start heartbeat monitoring for critical processes
   */
  private startHeartbeatMonitoring(processName: string) {
    const config = this.processes.get(processName);
    if (!config) return;

    // Clear existing interval if any
    if (config.heartbeatInterval) {
      clearInterval(config.heartbeatInterval);
    }

    // Check process health every 30 seconds
    config.heartbeatInterval = setInterval(() => {
      if (config.process && config.isRunning) {
        // Check if process is still alive
        try {
          process.kill(config.process.pid!, 0); // Signal 0 = check if alive
          logDebug(`${processName} heartbeat: alive`);
        } catch {
          logError(`${processName} heartbeat: process dead, restarting...`);
          config.isRunning = false;
          config.process = null;
          this.handleProcessRestart(processName);
        }
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop a specific process
   */
  stopProcess(processName: string): void {
    const config = this.processes.get(processName);
    if (!config) return;

    logInfo(`ProcessManager: Stopping ${processName}...`);
    config.shouldRestart = false;

    // Clear heartbeat
    if (config.heartbeatInterval) {
      clearInterval(config.heartbeatInterval);
      config.heartbeatInterval = undefined;
    }

    if (config.process) {
      try {
        // Simple kill - Node.js handles child cleanup automatically
        config.process.kill('SIGTERM');
        
        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (config.process && !config.process.killed) {
            logInfo(`ProcessManager: Force killing ${processName}`);
            config.process.kill('SIGKILL');
          }
        }, 2000);
      } catch (error: any) {
        logError(`ProcessManager: Error stopping ${processName}: ${error.message}`);
      }
    }

    config.isRunning = false;
    config.process = null;
  }

  /**
   * Get status of all managed processes
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, config] of this.processes) {
      status[name] = config.isRunning;
    }
    return status;
  }

  /**
   * Check if shortcuts daemon is running
   */
  isShortcutsDaemonRunning(): boolean {
    const config = this.processes.get('shortcuts-daemon');
    return config?.isRunning || false;
  }

  /**
   * Restart shortcuts daemon
   */
  async restartShortcutsDaemon(): Promise<boolean> {
    logInfo('ProcessManager: Restarting shortcuts daemon...');
    this.stopProcess('shortcuts-daemon');
    
    // Wait a bit for clean shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const config = this.processes.get('shortcuts-daemon');
    if (config) {
      config.shouldRestart = true;
      config.restartAttempts = 0; // Reset counter for manual restart
      return this.startProcess('shortcuts-daemon');
    }
    
    return false;
  }

  /**
   * Stop all managed processes
   */
  async stopAllProcesses(): Promise<void> {
    logInfo('ProcessManager: Stopping all processes...');
    for (const [name] of this.processes) {
      this.stopProcess(name);
    }
    // Wait a bit for processes to stop
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Shutdown all managed processes
   */
  shutdown(): void {
    if (this.isShuttingDown) return;
    
    logInfo('ProcessManager: Shutting down all processes...');
    this.isShuttingDown = true;

    for (const [name] of this.processes) {
      this.stopProcess(name);
    }
  }
}

// Singleton instance
export const processManager = new ProcessManager();