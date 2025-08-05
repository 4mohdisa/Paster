# Swift CLI Implementation Plan for AiPaste Electron Integration

## Overview

This document provides a comprehensive, practical implementation plan for building a Swift CLI tool and integrating it with the AiPaste Electron application. Based on analysis of existing Swift codebases (aipaste and angry-ants) and modern best practices, this plan offers actionable steps rather than theoretical concepts.

## Table of Contents

1. [Swift CLI Architecture](#swift-cli-architecture)
2. [Integration with Electron](#integration-with-electron)
3. [Code Examples](#code-examples)
4. [Development Workflow](#development-workflow)
5. [Process Management Strategies](#process-management-strategies)
6. [Error Handling & Recovery](#error-handling--recovery)
7. [Code Signing & Distribution](#code-signing--distribution)

## 1. Swift CLI Architecture

### 1.1 Project Structure

```
AiPasteCLI/
├── Package.swift
├── Sources/
│   ├── AiPasteCLI/
│   │   ├── main.swift
│   │   ├── Commands/
│   │   │   ├── OCRCommand.swift
│   │   │   ├── FormatCommand.swift
│   │   │   ├── MonitorCommand.swift
│   │   │   └── HealthCommand.swift
│   │   ├── Core/
│   │   │   ├── ClipboardMonitor.swift
│   │   │   ├── OCRProcessor.swift
│   │   │   ├── TextFormatter.swift
│   │   │   └── IPCHandler.swift
│   │   ├── Models/
│   │   │   ├── CLIResponse.swift
│   │   │   ├── OCRResult.swift
│   │   │   └── FormatRequest.swift
│   │   └── Utils/
│   │       ├── Logger.swift
│   │       ├── ConfigLoader.swift
│   │       └── Extensions.swift
│   └── AiPasteCore/
│       ├── SharedTypes.swift
│       ├── VisionHelpers.swift
│       └── ClipboardHelpers.swift
├── Tests/
│   └── AiPasteCLITests/
├── Resources/
│   └── config.json
└── README.md
```

### 1.2 Command Design Strategy

**Subcommand Architecture** (Recommended over flags-only approach):

```swift
// main.swift
import ArgumentParser

@main
struct AiPasteCLI: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "AI-powered clipboard and OCR processing tool",
        version: "1.0.0",
        subcommands: [
            OCRCommand.self,
            FormatCommand.self,
            MonitorCommand.self,
            HealthCommand.self
        ]
    )
}
```

**Benefits of this approach:**
- Clear separation of concerns
- Easy to extend with new features
- Better help documentation
- Follows Unix CLI conventions

### 1.3 Communication Protocol

**JSON-based IPC** (Recommended over plain text):

```swift
// Models/CLIResponse.swift
struct CLIResponse: Codable {
    let success: Bool
    let data: ResponseData?
    let error: CLIError?
    let timestamp: Date
    let requestId: String?
}

struct ResponseData: Codable {
    let type: ResponseType
    let content: String
    let metadata: [String: String]?
}

enum ResponseType: String, Codable {
    case ocr = "ocr"
    case format = "format"
    case monitor = "monitor"
    case health = "health"
}

struct CLIError: Codable {
    let code: String
    let message: String
    let details: [String: String]?
}
```

### 1.4 Error Reporting Format

Standardized error codes for consistent handling:

```swift
enum CLIErrorCode: String, CaseIterable {
    case invalidInput = "INVALID_INPUT"
    case visionFailed = "VISION_FAILED"
    case clipboardError = "CLIPBOARD_ERROR"
    case fileNotFound = "FILE_NOT_FOUND"
    case permissionDenied = "PERMISSION_DENIED"
    case internalError = "INTERNAL_ERROR"
    case timeout = "TIMEOUT"
}
```

## 2. Integration with Electron

### 2.1 Process Management

Based on analysis of the existing codebase (redis-manager.ts, postgres-manager.ts), here's the process management strategy:

```typescript
// src/main/cli/swift-cli-manager.ts
import { spawn, ChildProcess } from 'node:child_process';
import { app } from 'electron';
import path from 'node:path';
import { logInfo, logError, logWarn } from '../logger';

export class SwiftCLIManager {
    private static instance: SwiftCLIManager;
    private cliPath: string;
    private monitorProcess: ChildProcess | null = null;

    private constructor() {
        const isDev = !app.isPackaged;
        const platform = process.platform;
        
        this.cliPath = isDev
            ? path.join(app.getAppPath(), 'resources', 'cli', 'aipaste-cli')
            : path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'cli', 'aipaste-cli');
        
        this.ensureExecutablePermissions();
    }

    static getInstance(): SwiftCLIManager {
        if (!SwiftCLIManager.instance) {
            SwiftCLIManager.instance = new SwiftCLIManager();
        }
        return SwiftCLIManager.instance;
    }

    private ensureExecutablePermissions(): void {
        // Similar to redis-manager.ts implementation
        try {
            fs.accessSync(this.cliPath, fs.constants.F_OK | fs.constants.X_OK);
        } catch (error) {
            logWarn(`CLI binary lacks execute permissions, attempting to fix: ${this.cliPath}`);
            try {
                if (process.platform !== 'win32') {
                    execSync(`chmod +x "${this.cliPath}"`);
                    logInfo('Execute permissions added to CLI binary');
                }
            } catch (chmodError) {
                logError(`Failed to add execute permissions: ${chmodError}`);
                throw new Error(`Cannot execute CLI binary: ${this.cliPath}`);
            }
        }
    }
}
```

### 2.2 IPC Patterns for Different Use Cases

#### 2.2.1 Short-lived Commands (OCR, Format)

```typescript
async function executeOCRCommand(imagePath: string): Promise<OCRResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(this.cliPath, ['ocr', '--input', imagePath, '--format', 'json'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Failed to parse CLI response: ${error}`));
                }
            } else {
                reject(new Error(`CLI process exited with code ${code}: ${stderr}`));
            }
        });

        // Timeout handling
        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('CLI operation timed out'));
        }, 30000); // 30 second timeout

        child.on('exit', () => clearTimeout(timeout));
    });
}
```

#### 2.2.2 Long-running Processes (Clipboard Monitoring)

```typescript
startClipboardMonitor(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (this.monitorProcess && !this.monitorProcess.killed) {
            logInfo('Clipboard monitor already running');
            resolve();
            return;
        }

        this.monitorProcess = spawn(this.cliPath, ['monitor', '--json'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.monitorProcess.stdout?.on('data', (data) => {
            try {
                const events = data.toString().split('\n').filter(line => line.trim());
                events.forEach(eventStr => {
                    const event = JSON.parse(eventStr);
                    this.handleClipboardEvent(event);
                });
            } catch (error) {
                logError(`Failed to parse monitor event: ${error}`);
            }
        });

        this.monitorProcess.stderr?.on('data', (data) => {
            logError(`Monitor stderr: ${data}`);
        });

        this.monitorProcess.on('exit', (code, signal) => {
            logInfo(`Monitor process exited with code ${code}, signal ${signal}`);
            this.monitorProcess = null;
        });

        resolve();
    });
}
```

### 2.3 Resource Cleanup

```typescript
async stopAllProcesses(): Promise<void> {
    if (this.monitorProcess && !this.monitorProcess.killed) {
        logInfo('Stopping clipboard monitor');
        
        this.monitorProcess.kill('SIGTERM');
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.monitorProcess && !this.monitorProcess.killed) {
                    this.monitorProcess.kill('SIGKILL');
                }
                this.monitorProcess = null;
                resolve();
            }, 5000);

            this.monitorProcess?.on('exit', () => {
                clearTimeout(timeout);
                this.monitorProcess = null;
                logInfo('Clipboard monitor stopped');
                resolve();
            });
        });
    }
}
```

## 3. Code Examples

### 3.1 Swift CLI Structure

#### 3.1.1 OCR Command Implementation

```swift
// Commands/OCRCommand.swift
import ArgumentParser
import Foundation
import Vision

struct OCRCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "ocr",
        abstract: "Extract text from images using OCR"
    )
    
    @Option(name: .shortAndLong, help: "Input image path")
    var input: String?
    
    @Flag(name: .shortAndLong, help: "Read image from clipboard")
    var clipboard = false
    
    @Option(help: "Output format (json|text)")
    var format: OutputFormat = .json
    
    @Option(help: "Request ID for tracking")
    var requestId: String?
    
    func run() throws {
        let processor = OCRProcessor()
        let result: OCRResult
        
        if clipboard {
            result = try processor.processClipboard()
        } else if let inputPath = input {
            result = try processor.processFile(at: inputPath)
        } else {
            throw ValidationError("Either --input or --clipboard must be specified")
        }
        
        let response = CLIResponse(
            success: true,
            data: ResponseData(
                type: .ocr,
                content: result.text,
                metadata: result.metadata
            ),
            error: nil,
            timestamp: Date(),
            requestId: requestId
        )
        
        try outputResponse(response, format: format)
    }
}

enum OutputFormat: String, ExpressibleByArgument, CaseIterable {
    case json, text
}
```

#### 3.1.2 Clipboard Monitor Implementation

```swift
// Commands/MonitorCommand.swift
import ArgumentParser
import Foundation
import AppKit

struct MonitorCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "monitor",
        abstract: "Monitor clipboard for changes"
    )
    
    @Flag(help: "Output events as JSON")
    var json = false
    
    @Option(help: "Polling interval in seconds")
    var interval: Double = 1.0
    
    func run() throws {
        let monitor = ClipboardMonitor(interval: interval, jsonOutput: json)
        
        // Set up signal handling for graceful shutdown
        signal(SIGTERM) { _ in
            monitor.stop()
            exit(0)
        }
        
        signal(SIGINT) { _ in
            monitor.stop()
            exit(0)
        }
        
        try monitor.start()
        
        // Keep the process running
        RunLoop.main.run()
    }
}

// Core/ClipboardMonitor.swift
class ClipboardMonitor {
    private let interval: TimeInterval
    private let jsonOutput: Bool
    private var timer: Timer?
    private var lastChangeCount: Int = 0
    
    init(interval: TimeInterval, jsonOutput: Bool) {
        self.interval = interval
        self.jsonOutput = jsonOutput
        self.lastChangeCount = NSPasteboard.general.changeCount
    }
    
    func start() throws {
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.checkClipboard()
        }
    }
    
    func stop() {
        timer?.invalidate()
        timer = nil
    }
    
    private func checkClipboard() {
        let currentChangeCount = NSPasteboard.general.changeCount
        
        if currentChangeCount != lastChangeCount {
            lastChangeCount = currentChangeCount
            handleClipboardChange()
        }
    }
    
    private func handleClipboardChange() {
        // Process clipboard content and output event
        let event = ClipboardEvent(
            timestamp: Date(),
            changeCount: lastChangeCount,
            content: getClipboardContent()
        )
        
        if jsonOutput {
            outputJSONEvent(event)
        } else {
            outputTextEvent(event)
        }
    }
}
```

### 3.2 TypeScript Wrapper Class

```typescript
// src/main/cli/aipaste-cli-wrapper.ts
import { SwiftCLIManager } from './swift-cli-manager';

export class AiPasteCLIWrapper {
    private cliManager: SwiftCLIManager;

    constructor() {
        this.cliManager = SwiftCLIManager.getInstance();
    }

    async performOCR(options: OCROptions): Promise<OCRResult> {
        const args = ['ocr', '--format', 'json'];
        
        if (options.imagePath) {
            args.push('--input', options.imagePath);
        } else if (options.useClipboard) {
            args.push('--clipboard');
        } else {
            throw new Error('Either imagePath or useClipboard must be specified');
        }

        if (options.requestId) {
            args.push('--request-id', options.requestId);
        }

        return this.cliManager.executeCommand(args);
    }

    async formatText(text: string, format: TextFormat): Promise<string> {
        const args = [
            'format',
            '--input', text,
            '--format', format,
            '--output-format', 'json'
        ];

        const result = await this.cliManager.executeCommand(args);
        return result.data.content;
    }

    async startClipboardMonitor(): Promise<void> {
        return this.cliManager.startClipboardMonitor();
    }

    async stopClipboardMonitor(): Promise<void> {
        return this.cliManager.stopClipboardMonitor();
    }

    async healthCheck(): Promise<HealthStatus> {
        const args = ['health', '--format', 'json'];
        return this.cliManager.executeCommand(args);
    }
}

interface OCROptions {
    imagePath?: string;
    useClipboard?: boolean;
    requestId?: string;
}

interface OCRResult {
    text: string;
    confidence: number;
    metadata: Record<string, string>;
}

enum TextFormat {
    PLAIN = 'plain',
    MARKDOWN = 'markdown',
    HTML = 'html',
    PRETTIFIED = 'prettified'
}
```

### 3.3 IPC Communication Examples

#### 3.3.1 Renderer to Main Communication

```typescript
// src/preload/index.ts
const api = {
    clipboard: {
        performOCR: (options: OCROptions) => ipcRenderer.invoke('clipboard:ocr', options),
        formatText: (text: string, format: TextFormat) => ipcRenderer.invoke('clipboard:format', text, format),
        startMonitoring: () => ipcRenderer.invoke('clipboard:start-monitor'),
        stopMonitoring: () => ipcRenderer.invoke('clipboard:stop-monitor'),
        onClipboardChange: (callback: (event: ClipboardEvent) => void) => {
            ipcRenderer.on('clipboard:changed', (_, event) => callback(event));
        }
    }
};
```

#### 3.3.2 Main Process IPC Handlers

```typescript
// src/main/ipc-handlers/clipboard-handlers.ts
import { ipcMain } from 'electron';
import { AiPasteCLIWrapper } from '../cli/aipaste-cli-wrapper';

export function registerClipboardHandlers(): void {
    const cliWrapper = new AiPasteCLIWrapper();

    ipcMain.handle('clipboard:ocr', async (event, options: OCROptions) => {
        try {
            return await cliWrapper.performOCR(options);
        } catch (error) {
            logError('OCR operation failed:', error);
            throw error;
        }
    });

    ipcMain.handle('clipboard:format', async (event, text: string, format: TextFormat) => {
        try {
            return await cliWrapper.formatText(text, format);
        } catch (error) {
            logError('Text formatting failed:', error);
            throw error;
        }
    });

    ipcMain.handle('clipboard:start-monitor', async () => {
        try {
            await cliWrapper.startClipboardMonitor();
            return { success: true };
        } catch (error) {
            logError('Failed to start clipboard monitor:', error);
            throw error;
        }
    });
}
```

## 4. Development Workflow

### 4.1 Building and Testing

#### 4.1.1 Swift Package Manager Setup

```swift
// Package.swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AiPasteCLI",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .executable(name: "aipaste-cli", targets: ["AiPasteCLI"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.3.0"),
        .package(url: "https://github.com/soto-project/soto-core.git", from: "6.0.0")
    ],
    targets: [
        .executableTarget(
            name: "AiPasteCLI",
            dependencies: [
                .product(name: "ArgumentParser", package: "swift-argument-parser")
            ]
        ),
        .target(
            name: "AiPasteCore",
            dependencies: []
        ),
        .testTarget(
            name: "AiPasteCLITests",
            dependencies: ["AiPasteCLI"]
        )
    ]
)
```

#### 4.1.2 Build Scripts

```bash
#!/bin/bash
# scripts/build-cli.sh

set -e

echo "Building Swift CLI for production..."

# Clean previous builds
rm -rf .build/release

# Build for release
swift build -c release --arch arm64 --arch x86_64

# Create distribution directory
mkdir -p dist/cli

# Copy binary
cp .build/release/aipaste-cli dist/cli/

# Make executable
chmod +x dist/cli/aipaste-cli

echo "CLI build complete: dist/cli/aipaste-cli"
```

#### 4.1.3 Integration with Electron Build

```javascript
// scripts/prepare-cli.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function buildAndCopyCLI() {
    const cliDir = path.join(__dirname, '..', 'swift-cli');
    const resourcesDir = path.join(__dirname, '..', 'resources', 'cli');

    console.log('Building Swift CLI...');
    execSync('chmod +x scripts/build-cli.sh && ./scripts/build-cli.sh', {
        cwd: cliDir,
        stdio: 'inherit'
    });

    console.log('Copying CLI binary to resources...');
    if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
    }

    const sourcePath = path.join(cliDir, 'dist', 'cli', 'aipaste-cli');
    const destPath = path.join(resourcesDir, 'aipaste-cli');

    fs.copyFileSync(sourcePath, destPath);
    fs.chmodSync(destPath, 0o755);

    console.log('CLI preparation complete');
}

if (require.main === module) {
    buildAndCopyCLI();
}

module.exports = { buildAndCopyCLI };
```

### 4.2 Debugging Strategies

#### 4.2.1 Logging Configuration

```swift
// Utils/Logger.swift
import Foundation
import os.log

struct Logger {
    private static let subsystem = "com.neutralbase.aipaste.cli"
    
    static let general = OSLog(subsystem: subsystem, category: "general")
    static let ocr = OSLog(subsystem: subsystem, category: "ocr")
    static let clipboard = OSLog(subsystem: subsystem, category: "clipboard")
    static let ipc = OSLog(subsystem: subsystem, category: "ipc")
    
    static func debug(_ message: String, category: OSLog = .general) {
        os_log("%{public}@", log: category, type: .debug, message)
    }
    
    static func info(_ message: String, category: OSLog = .general) {
        os_log("%{public}@", log: category, type: .info, message)
    }
    
    static func error(_ message: String, category: OSLog = .general) {
        os_log("%{public}@", log: category, type: .error, message)
    }
}
```

#### 4.2.2 Development Mode Features

```swift
// Add to main.swift for debug builds
#if DEBUG
extension AiPasteCLI {
    static var debug: Bool {
        ProcessInfo.processInfo.environment["DEBUG"] == "1"
    }
}
#endif
```

#### 4.2.3 Testing Infrastructure

```swift
// Tests/AiPasteCLITests/OCRCommandTests.swift
import XCTest
@testable import AiPasteCLI

final class OCRCommandTests: XCTestCase {
    func testOCRCommandWithValidImage() async throws {
        let testImagePath = Bundle.module.path(forResource: "test-image", ofType: "png")!
        
        let command = OCRCommand()
        command.input = testImagePath
        command.format = .json
        
        // Capture stdout
        let originalStdout = stdout
        defer { stdout = originalStdout }
        
        let pipe = Pipe()
        stdout = pipe.fileHandleForWriting
        
        try command.run()
        
        pipe.fileHandleForWriting.closeFile()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8)!
        
        let response = try JSONDecoder().decode(CLIResponse.self, from: output.data(using: .utf8)!)
        XCTAssertTrue(response.success)
        XCTAssertNotNil(response.data)
    }
}
```

### 4.3 Deployment Process

#### 4.3.1 Electron Builder Configuration

```yaml
# electron-builder.yml (updated section)
mac:
  icon: electron-build-assets/icons.icns
  entitlements: electron-build-assets/entitlements.mac.plist
  entitlementsInherit: electron-build-assets/entitlements.mac.plist
  category: public.app-category.productivity
  target:
    - target: dmg
      arch: [x64, arm64]

files:
  - "!**/.DS_Store"
  - "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}"
  - "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}"
  - "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}"
  - "!.idea"
  - "!**/._*"
  - "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}"
  - "!resources/cli/**/*.{swift,md,LICENSE}"
  
extraResources:
  - from: "resources/cli/aipaste-cli"
    to: "cli/aipaste-cli"
    filter: ["**/*"]

asarUnpack:
  - "resources/cli/**/*"
```

## 5. Process Management Strategies

### 5.1 Process Lifecycle Management

Based on the Redis and PostgreSQL managers in the existing codebase, here's the recommended approach:

```typescript
export class CLIProcessManager {
    private processes: Map<string, ProcessInfo> = new Map();

    async startLongRunningProcess(
        processId: string, 
        command: string[], 
        options: ProcessOptions
    ): Promise<ChildProcess> {
        if (this.processes.has(processId)) {
            const existing = this.processes.get(processId)!;
            if (!existing.process.killed) {
                return existing.process;
            }
        }

        const process = spawn(this.cliPath, command, {
            stdio: ['pipe', 'pipe', 'pipe'],
            ...options
        });

        const processInfo: ProcessInfo = {
            process,
            startTime: Date.now(),
            command,
            options
        };

        this.processes.set(processId, processInfo);

        // Set up process monitoring
        this.setupProcessMonitoring(processId, process);

        return process;
    }

    private setupProcessMonitoring(processId: string, process: ChildProcess): void {
        process.on('exit', (code, signal) => {
            logInfo(`Process ${processId} exited with code ${code}, signal ${signal}`);
            this.processes.delete(processId);
        });

        process.on('error', (error) => {
            logError(`Process ${processId} error: ${error}`);
            this.processes.delete(processId);
        });

        // Health check timer
        const healthCheckInterval = setInterval(() => {
            if (process.killed) {
                clearInterval(healthCheckInterval);
                return;
            }
            
            // Send health check if process supports it
            this.sendHealthCheck(processId);
        }, 30000); // 30 second intervals
    }
}
```

### 5.2 Resource Monitoring

```typescript
interface ProcessMetrics {
    pid: number;
    memory: number;
    cpu: number;
    uptime: number;
}

class ProcessMonitor {
    async getProcessMetrics(pid: number): Promise<ProcessMetrics> {
        try {
            const process = require('process');
            // Use platform-specific commands to get process stats
            if (process.platform === 'darwin') {
                return this.getMacOSProcessStats(pid);
            }
            // Add other platforms as needed
            throw new Error(`Unsupported platform: ${process.platform}`);
        } catch (error) {
            logError(`Failed to get process metrics: ${error}`);
            throw error;
        }
    }

    private async getMacOSProcessStats(pid: number): Promise<ProcessMetrics> {
        return new Promise((resolve, reject) => {
            exec(`ps -o pid,rss,pcpu,etime -p ${pid}`, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                // Parse ps output
                const lines = stdout.trim().split('\n');
                if (lines.length < 2) {
                    reject(new Error('Process not found'));
                    return;
                }
                
                const data = lines[1].trim().split(/\s+/);
                resolve({
                    pid: parseInt(data[0]),
                    memory: parseInt(data[1]) * 1024, // Convert KB to bytes
                    cpu: parseFloat(data[2]),
                    uptime: this.parseUptime(data[3])
                });
            });
        });
    }
}
```

## 6. Error Handling & Recovery

### 6.1 Swift Error Handling

```swift
// Core/ErrorHandling.swift
enum CLIError: Error, LocalizedError {
    case invalidInput(String)
    case visionError(String)
    case clipboardError(String)
    case fileSystemError(String)
    case timeout
    case internalError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidInput(let details):
            return "Invalid input: \(details)"
        case .visionError(let details):
            return "Vision processing failed: \(details)"
        case .clipboardError(let details):
            return "Clipboard operation failed: \(details)"
        case .fileSystemError(let details):
            return "File system error: \(details)"
        case .timeout:
            return "Operation timed out"
        case .internalError(let details):
            return "Internal error: \(details)"
        }
    }
    
    var cliErrorCode: CLIErrorCode {
        switch self {
        case .invalidInput:
            return .invalidInput
        case .visionError:
            return .visionFailed
        case .clipboardError:
            return .clipboardError
        case .fileSystemError:
            return .fileNotFound
        case .timeout:
            return .timeout
        case .internalError:
            return .internalError
        }
    }
}

extension CLIError {
    func toCLIResponse(requestId: String? = nil) -> CLIResponse {
        return CLIResponse(
            success: false,
            data: nil,
            error: CLIError(
                code: self.cliErrorCode.rawValue,
                message: self.localizedDescription,
                details: nil
            ),
            timestamp: Date(),
            requestId: requestId
        )
    }
}
```

### 6.2 Retry Mechanisms

```typescript
class RetryManager {
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            backoffFactor = 2,
            retryableErrors = ['TIMEOUT', 'INTERNAL_ERROR']
        } = options;

        let lastError: Error;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt === maxRetries) {
                    throw lastError;
                }

                // Check if error is retryable
                if (!this.isRetryableError(error, retryableErrors)) {
                    throw error;
                }

                const delay = Math.min(
                    baseDelay * Math.pow(backoffFactor, attempt),
                    maxDelay
                );

                logWarn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${error}`);
                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    private isRetryableError(error: any, retryableErrors: string[]): boolean {
        if (error?.code && retryableErrors.includes(error.code)) {
            return true;
        }
        
        // Check for specific error patterns
        const errorMessage = error?.message?.toLowerCase() || '';
        return errorMessage.includes('timeout') || 
               errorMessage.includes('connection') ||
               errorMessage.includes('temporary');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### 6.3 Circuit Breaker Pattern

```typescript
class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000,
        private monitor: (state: string) => void = () => {}
    ) {}

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime < this.timeout) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
        this.monitor('CLOSED');
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            this.monitor('OPEN');
        }
    }
}
```

## 7. Code Signing & Distribution

### 7.1 Code Signing Configuration

Based on research findings, here's the recommended approach:

```bash
#!/bin/bash
# scripts/sign-cli.sh

set -e

CLI_BINARY="dist/cli/aipaste-cli"
DEVELOPER_ID="Developer ID Application: Your Name (TEAM_ID)"

echo "Signing CLI binary..."

# Sign the CLI binary
codesign --force --sign "$DEVELOPER_ID" --timestamp --options runtime "$CLI_BINARY"

# Verify signature
codesign --verify --verbose "$CLI_BINARY"

echo "CLI binary signed successfully"
```

### 7.2 Notarization Process

```bash
#!/bin/bash
# scripts/notarize-cli.sh

set -e

CLI_BINARY="dist/cli/aipaste-cli"
BUNDLE_ID="com.neutralbase.aipaste.cli"
APPLE_ID="your-apple-id@example.com"
TEAM_ID="YOUR_TEAM_ID"

# Create zip for notarization
ZIP_FILE="aipaste-cli.zip"
zip -r "$ZIP_FILE" "$CLI_BINARY"

echo "Submitting for notarization..."

# Submit for notarization (using app-specific password)
xcrun notarytool submit "$ZIP_FILE" \
    --apple-id "$APPLE_ID" \
    --password "$NOTARY_PASSWORD" \
    --team-id "$TEAM_ID" \
    --wait

echo "Notarization complete"

# Clean up
rm "$ZIP_FILE"
```

### 7.3 Electron Builder Integration

```javascript
// electron-build-assets/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    
    if (electronPlatformName !== 'darwin') {
        return;
    }

    const appName = context.packager.appInfo.productFilename;

    return await notarize({
        appBundleId: 'com.neutralbase.aipaste',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
    });
};
```

### 7.4 Distribution Workflow

```bash
#!/bin/bash
# scripts/build-and-sign.sh

set -e

echo "Building and signing AiPaste CLI..."

# Build CLI
cd swift-cli
./scripts/build-cli.sh
cd ..

# Sign CLI binary
./scripts/sign-cli.sh

# Notarize CLI binary
./scripts/notarize-cli.sh

# Prepare for Electron build
node scripts/prepare-cli.js

# Build Electron app (which will include signed CLI)
npm run build

echo "Build and signing complete!"
```

## 8. Performance Optimizations

### 8.1 Process Pool Management

```typescript
class CLIProcessPool {
    private pool: ChildProcess[] = [];
    private busy: Set<ChildProcess> = new Set();
    private readonly maxPoolSize = 3;

    async getProcess(): Promise<ChildProcess> {
        // Return available process from pool
        const available = this.pool.find(p => !this.busy.has(p) && !p.killed);
        if (available) {
            this.busy.add(available);
            return available;
        }

        // Create new process if pool not full
        if (this.pool.length < this.maxPoolSize) {
            const process = this.createProcess();
            this.pool.push(process);
            this.busy.add(process);
            return process;
        }

        // Wait for process to become available
        return new Promise((resolve) => {
            const checkAvailable = () => {
                const available = this.pool.find(p => !this.busy.has(p) && !p.killed);
                if (available) {
                    this.busy.add(available);
                    resolve(available);
                } else {
                    setTimeout(checkAvailable, 100);
                }
            };
            checkAvailable();
        });
    }

    releaseProcess(process: ChildProcess): void {
        this.busy.delete(process);
    }

    private createProcess(): ChildProcess {
        const process = spawn(this.cliPath, ['daemon'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        process.on('exit', () => {
            this.pool = this.pool.filter(p => p !== process);
            this.busy.delete(process);
        });

        return process;
    }
}
```

### 8.2 Caching Strategy

```swift
// Core/CacheManager.swift
class CacheManager {
    private let cache = NSCache<NSString, CacheItem>()
    private let cacheQueue = DispatchQueue(label: "com.aipaste.cache", qos: .utility)
    
    init() {
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB
    }
    
    func getCachedResult(for key: String) -> CacheItem? {
        return cache.object(forKey: NSString(string: key))
    }
    
    func setCachedResult(_ item: CacheItem, for key: String) {
        cacheQueue.async {
            self.cache.setObject(item, forKey: NSString(string: key), cost: item.size)
        }
    }
}

struct CacheItem {
    let data: Data
    let timestamp: Date
    let size: Int
    
    var isExpired: Bool {
        Date().timeIntervalSince(timestamp) > 300 // 5 minutes
    }
}
```

## Conclusion

This implementation plan provides a comprehensive, practical approach to building and integrating a Swift CLI tool with the AiPaste Electron application. The plan is based on:

1. **Real-world patterns** from the existing codebase analysis
2. **Modern Swift CLI best practices** using ArgumentParser
3. **Proven Electron process management** patterns
4. **Production-ready error handling** and recovery strategies
5. **Complete development workflow** including testing and deployment

The modular architecture allows for incremental implementation, starting with basic OCR functionality and expanding to include clipboard monitoring and text formatting features. The JSON-based IPC protocol ensures type safety and extensibility, while the process management strategies provide reliability and performance.

Key benefits of this approach:
- **Type-safe communication** between Electron and Swift
- **Robust error handling** with retry mechanisms
- **Production-ready process management** 
- **Comprehensive testing infrastructure**
- **Complete build and deployment pipeline**

Follow the implementation steps in order, testing each component thoroughly before proceeding to the next. This approach minimizes risk and ensures a stable, maintainable solution.