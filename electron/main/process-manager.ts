import { ChildProcess, spawn } from 'child_process';
import { app, systemPreferences } from 'electron';
import { EventEmitter } from 'events';
import { pathConfig } from './config/paths';
import { logError, logInfo, logDebug } from './logger';
import { historyManager } from './history-manager';
import { convexClient } from './convex-client';
import { api } from '../../convex/_generated/api';
import * as fs from 'fs';
import * as net from 'net';
import * as http from 'http';
import * as path from 'path';

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
  private convexInfo: { backendUrl: string; actionsUrl: string; dataDir: string } | null = null;

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
  /**
   * Start Finder selection monitor process
   */
  async startFinderMonitor(): Promise<boolean> {
    logInfo('ProcessManager: Starting Finder selection monitor');
    
    // Stop existing monitor if running
    this.stopFinderMonitor();
    
    const config: ManagedProcess = {
      name: 'finder-monitor',
      process: null,
      command: this.binaryPath,
      args: ['finder-selection', '--monitor'],
      restartAttempts: 0,
      maxRestarts: 3,
      restartDelay: 2000,
      isRunning: false,
      shouldRestart: true,
      lastStartTime: Date.now()
    };
    
    this.processes.set('finder-monitor', config);
    return this.startProcess('finder-monitor');
  }
  
  /**
   * Stop Finder selection monitor
   */
  stopFinderMonitor(): void {
    const config = this.processes.get('finder-monitor');
    if (config) {
      config.shouldRestart = false;
      if (config.process) {
        logInfo('ProcessManager: Stopping Finder monitor');
        config.process.kill();
        config.process = null;
      }
      this.processes.delete('finder-monitor');
    }
  }

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
    // Handle Finder selection changes
    else if (response.event === 'finder-selection-changed') {
      logInfo(`Finder selection changed`);
      this.emit('finder-selection-changed', response.data || '');
    }
    // Handle shortcut trigger - check which shortcut was pressed
    else if (response.event === 'shortcut-triggered') {
      const keyData = response.data;
      
      // Check if it's Cmd+Shift+K (keyCode 40 with Cmd+Shift modifiers)
      // Modifiers: Cmd = 1048576, Shift = 131072, Cmd+Shift = 1179648
      if (keyData && typeof keyData === 'string') {
        try {
          const parsed = JSON.parse(keyData);
          const modifiers = parsed.modifiers || 0;
          const keyCode = parsed.keyCode || 0;
          
          // Cmd+Shift+K: keyCode 40, modifiers 3 (Cmd=1, Shift=2, Cmd+Shift=3)
          if (keyCode === 40 && modifiers === 3) {
            logInfo('Cmd+Shift+K detected - triggering Kash conversion');
            
            // Get Finder selection and process with Kash
            const { pythonBridge } = require('./python-bridge');
            const { swiftBridge } = require('./swift-bridge');
            
            try {
              // Get selected files from Finder
              const selectionResult = await swiftBridge.execute(['finder-selection']);
              
              if (selectionResult.success && selectionResult.data) {
                // Swift returns newline-separated paths, not JSON
                const files = selectionResult.data.split('\n').filter(path => path.trim());
                
                if (files && files.length > 0) {
                  logInfo(`Processing ${files.length} files with Kash`);
                  
                  // Determine action based on file extension
                  const { getActionForFile } = require('./kash-actions-config');
                  const firstFile = files[0];
                  // For now, assume docx_to_markdown is enabled (it's installed by default)
                  const enabledActions = ['docx_to_markdown', 'html_to_markdown'];
                  const action = getActionForFile(firstFile, enabledActions) || 'markdownify';
                  logInfo(`Using action '${action}' for file: ${firstFile}`);
                  
                  // Process with Kash
                  const processResult = await pythonBridge.processFiles(files, action);
                  
                  // Save to Convex directly from backend if successful
                  if (processResult.success) {
                    try {
                      const client = convexClient.getClient();
                      await client.mutation(api.conversionHistory.addConversion, {
                        originalPath: processResult.input_file || files[0] || '',
                        originalName: processResult.input_file?.split('/').pop() || 'Unknown',
                        convertedPath: processResult.output_file || '',
                        convertedName: processResult.output_file?.split('/').pop() || 'Unknown',
                        fromFormat: processResult.format?.input || 'unknown',
                        toFormat: processResult.format?.output || 'markdown',
                        fileSize: processResult.content_length,
                        preview: processResult.content_preview?.substring(0, 200),
                        success: true,
                      });
                      logInfo('✅ Conversion history saved to Convex from backend');
                    } catch (error) {
                      logError(`Failed to save to Convex: ${error}`);
                    }
                  }
                  
                  // Emit event for UI update
                  this.emit('kash-conversion-complete', {
                    files,
                    result: processResult,
                    timestamp: new Date().toISOString()
                  });
                  
                  // Notify user via IPC
                  const { BrowserWindow } = require('electron');
                  const windows = BrowserWindow.getAllWindows();
                  windows.forEach(window => {
                    window.webContents.send('kash-conversion-complete', {
                      files,
                      result: processResult
                    });
                  });
                } else {
                  logInfo('No files selected in Finder for Kash conversion');
                }
              }
            } catch (error) {
              logError(`Kash conversion error: ${error}`);
            }
          } else {
            // Original paste from history logic for Cmd+V
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
          }
        } catch (e) {
          logError(`Failed to parse shortcut data: ${e}`);
        }
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
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Start the Convex backend process (always starts fresh instance)
   */
  async startConvexBackend(): Promise<boolean> {
    logInfo('ProcessManager: Starting Convex backend...');
    
    // Get configuration
    const convexConfig = pathConfig.getConvexConfig();
    const dataDir = pathConfig.getConvexDataDir();
    const binaryPath = pathConfig.getConvexBinaryPath();
    
    logInfo(`ProcessManager: Looking for Convex binary at: ${binaryPath}`);
    logInfo(`ProcessManager: Binary exists: ${fs.existsSync(binaryPath)}`);
    
    // Check if binary exists
    if (!fs.existsSync(binaryPath)) {
      logError(`ProcessManager: Convex binary not found at ${binaryPath}`);
      logError('ProcessManager: Attempting to download Convex binary...');
      
      // Try to download the binary
      try {
        const { execSync } = require('child_process');
        const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'download-convex-binary.js');
        
        if (fs.existsSync(scriptPath)) {
          logInfo('ProcessManager: Running download script...');
          execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
          
          // Check again after download
          if (fs.existsSync(binaryPath)) {
            logInfo('ProcessManager: Convex binary downloaded successfully!');
          } else {
            throw new Error('Binary still missing after download attempt');
          }
        } else {
          throw new Error('Download script not found');
        }
      } catch (downloadError: any) {
        logError(`ProcessManager: Failed to download Convex binary: ${downloadError.message}`);
        this.emit('convex-error', {
          type: 'binary-missing',
          message: 'Convex backend binary not found and could not be downloaded. Please run: pnpm --filter @paster/electron convex:download'
        });
        return false;
      }
    }
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logInfo(`ProcessManager: Created Convex data directory at ${dataDir}`);
    }
    
    // Check port availability
    const backendAvailable = await this.isPortAvailable(convexConfig.backendPort);
    const actionsAvailable = await this.isPortAvailable(convexConfig.actionsPort);
    
    if (!backendAvailable || !actionsAvailable) {
      logError(`ProcessManager: Convex ports ${convexConfig.backendPort}/${convexConfig.actionsPort} are already in use`);
      this.emit('convex-error', {
        type: 'port-conflict',
        message: `Ports ${convexConfig.backendPort} or ${convexConfig.actionsPort} are already in use. Please close any other Convex instances.`
      });
      return false;
    }
    
    // Prepare process configuration
    const config: ManagedProcess = {
      name: 'convex-backend',
      process: null,
      command: binaryPath,
      args: [
        '--port', convexConfig.backendPort.toString(),
        '--site-proxy-port', convexConfig.actionsPort.toString()
      ],
      restartAttempts: 0,
      maxRestarts: 3,
      restartDelay: 2000,
      isRunning: false,
      shouldRestart: true,
      lastStartTime: Date.now()
    };
    
    this.processes.set('convex-backend', config);
    
    // Store Convex info for IPC handlers
    this.convexInfo = {
      backendUrl: convexConfig.backendUrl,
      actionsUrl: convexConfig.actionsUrl,
      dataDir
    };
    
    return this.startConvexProcess('convex-backend');
  }
  
  /**
   * Start a Convex process with specific handling
   */
  private startConvexProcess(processName: string): boolean {
    const config = this.processes.get(processName);
    if (!config) return false;
    
    if (config.isRunning) {
      logInfo(`ProcessManager: ${processName} is already running`);
      return true;
    }
    
    try {
      const dataDir = pathConfig.getConvexDataDir();
      
      config.process = spawn(config.command, config.args, {
        cwd: dataDir, // Set working directory for database storage
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Add any Convex-specific environment variables here
        }
      });
      
      config.isRunning = true;
      config.lastStartTime = Date.now();

      // Handle stdout for readiness detection
      config.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        logDebug(`${processName} stdout: ${output}`);
      });
      
      // Handle stderr
      config.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        logError(`${processName} stderr: ${error}`);
      });
      
      // Handle process exit
      config.process.on('exit', (code: number | null, signal: string | null) => {
        logInfo(`ProcessManager: ${processName} exited with code ${code}, signal ${signal}`);
        config.isRunning = false;
        config.process = null;
        
        if (!this.isShuttingDown && config.shouldRestart) {
          this.handleProcessRestart(processName);
        }
      });
      
      // Handle process errors
      config.process.on('error', (error: Error) => {
        logError(`ProcessManager: ${processName} error: ${error.message}`);
        config.isRunning = false;
        config.process = null;
        
        this.emit('convex-error', {
          type: 'process-error',
          message: error.message
        });
        
        if (!this.isShuttingDown && config.shouldRestart) {
          this.handleProcessRestart(processName);
        }
      });
      
      // Start heartbeat monitoring
      this.startHeartbeatMonitoring(processName);
      
      logInfo(`ProcessManager: ${processName} started with PID ${config.process.pid}`);
      
      // Readiness: actively poll the configured backend URL instead of parsing stdout
      const convexConfig = pathConfig.getConvexConfig();
      this.waitForConvexReady(convexConfig.backendUrl)
        .then(() => {
          logInfo(`ProcessManager: ${processName} is ready at ${convexConfig.backendUrl}`);
          convexClient.initialize(convexConfig.backendUrl);
          this.emit('convex-ready', this.convexInfo);
        })
        .catch((err) => {
          logError(`ProcessManager: ${processName} readiness check failed: ${err?.message || err}`);
          this.emit('convex-error', { type: 'start-failed', message: 'Convex backend failed readiness check' });
        });

      return true;
      
    } catch (error: any) {
      logError(`ProcessManager: Failed to start ${processName}: ${error.message}`);
      config.isRunning = false;
      config.process = null;
      
      this.emit('convex-error', {
        type: 'start-failed',
        message: error.message
      });
      
      return false;
    }
  }
  
  /**
   * Stop the Convex backend
   */
  stopConvexBackend(): void {
    logInfo('ProcessManager: Stopping Convex backend...');
    this.stopProcess('convex-backend');
    this.convexInfo = null;
  }
  
  /**
   * Get Convex backend status and info
   */
  getConvexInfo(): { running: boolean; backendUrl?: string; actionsUrl?: string; dataDir?: string } {
    const config = this.processes.get('convex-backend');
    const running = config?.isRunning || false;
    
    if (running && this.convexInfo) {
      return {
        running,
        ...this.convexInfo
      };
    }
    
    return { running };
  }
  
  /**
   * Check if Convex backend is running
   */
  isConvexBackendRunning(): boolean {
    const config = this.processes.get('convex-backend');
    return config?.isRunning || false;
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

  /**
   * Poll the Convex backend URL until it responds or timeout
   */
  private async waitForConvexReady(url: string, timeoutMs: number = 15000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const attempt = () => {
        const elapsed = Date.now() - start;
        if (elapsed > timeoutMs) {
          return reject(new Error('Timeout waiting for Convex backend'));
        }

        try {
          const req = http.get(url, (res) => {
            // Any HTTP response means the server is up
            res.resume(); // drain
            resolve();
          });
          req.on('error', () => {
            setTimeout(attempt, 300);
          });
          req.setTimeout(1000, () => {
            req.destroy();
            setTimeout(attempt, 300);
          });
        } catch {
          setTimeout(attempt, 300);
        }
      };
      attempt();
    });
  }
}

// Singleton instance
export const processManager = new ProcessManager();
