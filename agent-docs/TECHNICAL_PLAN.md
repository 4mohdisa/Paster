# Technical Implementation Plan: Porting AiPaste and TRex to Electron

**Version:** 1.0  
**Date:** 2025-08-05  
**Project:** electron-aipaste  

## 1. Source Code Analysis

### 1.1 AiPaste Swift Implementation Analysis

Based on analysis of `/Users/moinulmoin/Developer/clients/neutralbase/aipaste/`:

#### Core Components:
- **PasteManager.swift**: Main clipboard processing logic
  - Detects delimiters (tabs) in clipboard content
  - Converts HTML tables to pipe-delimited format
  - Handles CSV/TSV data transformation
  - Supports multiple output formats (plain text, prettified, HTML, Markdown)
  - Custom prefix handling for table formatting

- **EventTap.swift**: Global keyboard shortcut handling
  - Uses `CGEvent.tapCreate()` for system-wide key capture
  - Implements `CGEventTapCallBack` for event processing
  - Requires accessibility permissions on macOS

- **AppDelegate.swift**: Application lifecycle management
  - Menu bar integration with `NSStatusItem`
  - Custom shortcut detection (Cmd+Shift+V by default)
  - Clipboard manipulation and automated paste functionality
  - Accessibility permission checking via `AXIsProcessTrusted`

#### Key Swift Files to Port:
1. `PasteManager.swift` - Table formatting and clipboard processing
2. `Events/EventTap.swift` - Global keyboard event capture
3. `Main/AppDelegate.swift` - System integration and permissions
4. `Helpers/StorageHelper.swift` - Preferences and settings management

### 1.2 TRex/Angry-Ants OCR Implementation Analysis

Based on analysis of `/Users/moinulmoin/Developer/clients/neutralbase/angry-ants/`:

#### Core OCR Components:
- **AiPasteCore.swift**: OCR engine implementation
  - Uses macOS Vision framework for text recognition
  - Supports multiple invocation modes (screen capture, clipboard, file)
  - QR code detection with `CIDetector`
  - Screenshot capture via `/usr/sbin/screencapture`
  - Multi-language OCR support with automatic language detection

- **EventTap.swift**: Enhanced keyboard shortcuts
  - Supports dual shortcuts (Cmd+Shift+V for paste, Cmd+Shift+2 for OCR)
  - Event tap management with proper cleanup

- **Preferences.swift**: Configuration management
  - Language selection for OCR
  - Capture settings (sound, notifications)
  - Custom word lists for improved accuracy
  - Automation integration (shortcuts, URL opening)

#### Key Swift Files to Port:
1. `Packages/AiPasteCore/Sources/AiPasteCore/AiPasteCore.swift` - OCR functionality
2. `AiPaste/AppDelegate.swift` - Enhanced app lifecycle with OCR shortcuts
3. `Packages/AiPasteCore/Sources/AiPasteCore/Preferences.swift` - Settings management
4. `Packages/AiPasteCore/Sources/AiPasteCore/Invocationmode.swift` - Capture modes

#### Dependencies and Frameworks:
- **Vision**: macOS native OCR framework
- **CoreImage**: QR code detection (`CIDetector`)
- **UserNotifications**: Result notifications
- **KeyboardShortcuts**: Third-party shortcut management

## 2. Technical Architecture

### 2.1 Electron + Swift Bridge Design

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   IPC Handlers  │    │     Global Shortcuts        │ │
│  │                 │    │    (electron-shortcuts)     │ │
│  └─────────────────┘    └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                 Native Module Bridge                    │
│          (Objective-C++ with N-API bindings)           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ Clipboard Module│    │      OCR Module             │ │
│  │   (Swift)       │    │     (Swift + Vision)        │ │
│  └─────────────────┘    └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│           macOS System Integration                      │
│  • Accessibility API    • Vision Framework             │
│  • Clipboard API        • Screen Capture               │
│  • Global Event Tap     • CoreImage (QR)               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Process Architecture

- **Main Process**: Electron main process manages application lifecycle, IPC, and native module loading
- **Renderer Process**: Next.js application for settings UI and user interface
- **Native Modules**: Swift-based addons for clipboard monitoring and OCR functionality
- **IPC Communication**: Secure message passing between processes using Electron's IPC

### 2.3 Security Considerations

- **Sandboxing**: Native modules run with restricted permissions
- **IPC Validation**: All inter-process communication validated and sanitized
- **Permission Management**: Proper handling of macOS accessibility and screen recording permissions
- **Data Protection**: Clipboard and OCR data processed locally, no external transmission

## 3. Implementation Details

### 3.1 Native Module Design

#### 3.1.1 Swift to Node.js Bridge Architecture

**File Structure:**
```
native-modules/
├── clipboard-monitor/
│   ├── binding.gyp
│   ├── src/
│   │   ├── clipboard_addon.mm      # Objective-C++ N-API bridge
│   │   ├── ClipboardMonitor.swift  # Swift clipboard logic
│   │   └── ClipboardBridge.h/.mm   # Objective-C bridge
│   └── package.json
└── ocr-engine/
    ├── binding.gyp
    ├── src/
    │   ├── ocr_addon.mm           # Objective-C++ N-API bridge
    │   ├── OCREngine.swift        # Swift OCR implementation
    │   └── OCRBridge.h/.mm        # Objective-C bridge
    └── package.json
```

#### 3.1.2 N-API Integration Pattern

**Objective-C++ Bridge (clipboard_addon.mm):**
```cpp
#import <napi.h>
#import "ClipboardBridge.h"

Napi::Value StartClipboardMonitoring(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Extract callback function
    Napi::Function callback = info[0].As<Napi::Function>();
    
    // Start monitoring in Swift
    [[ClipboardBridge shared] startMonitoringWithCallback:^(NSString* content, NSString* format) {
        // Convert to JavaScript types and call callback
        auto jsCallback = Napi::ThreadSafeFunction::New(
            env, callback, "ClipboardCallback", 0, 1
        );
        
        jsCallback.BlockingCall([content, format](Napi::Env env, Napi::Function jsCallback) {
            jsCallback.Call({
                Napi::String::New(env, [content UTF8String]),
                Napi::String::New(env, [format UTF8String])
            });
        });
    }];
    
    return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startClipboardMonitoring", 
                Napi::Function::New(env, StartClipboardMonitoring));
    return exports;
}

NODE_API_MODULE(clipboard_monitor, Init)
```

#### 3.1.3 Build Configuration (binding.gyp)

```json
{
  "targets": [
    {
      "target_name": "clipboard_monitor",
      "sources": [
        "src/clipboard_addon.mm",
        "src/ClipboardBridge.mm",
        "src/ClipboardMonitor.swift"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "xcode_settings": {
        "SWIFT_VERSION": "5.0",
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "OTHER_LDFLAGS": [
          "-framework Foundation",
          "-framework AppKit",
          "-framework Vision",
          "-framework CoreImage"
        ]
      },
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}
```

### 3.2 Clipboard Implementation

#### 3.2.1 Swift Clipboard Monitor

**ClipboardMonitor.swift:**
```swift
import Foundation
import AppKit

@objc public class ClipboardMonitor: NSObject {
    private var changeCount: Int = 0
    private var timer: Timer?
    private var callback: ((String, String) -> Void)?
    
    @objc public func startMonitoring(callback: @escaping (String, String) -> Void) {
        self.callback = callback
        self.changeCount = NSPasteboard.general.changeCount
        
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            self.checkClipboard()
        }
    }
    
    private func checkClipboard() {
        let pasteboard = NSPasteboard.general
        
        if pasteboard.changeCount != changeCount {
            changeCount = pasteboard.changeCount
            
            // Detect content type and format
            if let htmlData = pasteboard.data(forType: .html),
               let htmlString = String(data: htmlData, encoding: .utf8) {
                callback?(htmlString, "html")
            } else if let plainString = pasteboard.string(forType: .string) {
                callback?(plainString, "text")
            }
        }
    }
    
    @objc public func stopMonitoring() {
        timer?.invalidate()
        timer = nil
    }
}
```

#### 3.2.2 Table Formatting Logic

**Port PasteManager functionality:**
```swift
@objc public class TableFormatter: NSObject {
    @objc public func formatTable(_ content: String, format: String) -> String {
        // Port delimiter detection logic
        let delimiter = detectDelimiter(in: content)
        
        // Port table conversion logic
        return convertToFormattedTable(text: content, format: .plainText)
    }
    
    private func detectDelimiter(in text: String) -> String {
        // Port delimiter detection from PasteManager.swift
        let delimiters = ["\t"]
        var delimiterCounts: [String: Int] = [:]
        
        if let firstLine = text.components(separatedBy: .newlines).first(where: { !$0.isEmpty }) {
            for delimiter in delimiters {
                let count = firstLine.components(separatedBy: delimiter).count - 1
                delimiterCounts[delimiter] = count
            }
        }
        
        return delimiterCounts.max(by: { $0.value < $1.value })?.key ?? "\t"
    }
}
```

### 3.3 OCR Implementation

#### 3.3.1 Swift OCR Engine using Vision Framework

**OCREngine.swift:**
```swift
import Vision
import CoreImage
import AppKit

@objc public class OCREngine: NSObject {
    @objc public func performOCR(on imagePath: String, 
                                 language: String,
                                 completion: @escaping (String?, Error?) -> Void) {
        
        guard let image = NSImage(contentsOfFile: imagePath)?.cgImage(
            forProposedRect: nil, context: nil, hints: nil
        ) else {
            completion(nil, OCRError.invalidImage)
            return
        }
        
        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                completion(nil, error)
                return
            }
            
            let recognizedText = self.processResults(request.results)
            completion(recognizedText, nil)
        }
        
        // Configure request based on language
        request.recognitionLanguages = [language]
        request.usesLanguageCorrection = true
        request.recognitionLevel = .accurate
        
        if #available(macOS 13.0, *) {
            request.automaticallyDetectsLanguage = true
        }
        
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                completion(nil, error)
            }
        }
    }
    
    private func processResults(_ results: [Any]?) -> String {
        guard let results = results as? [VNRecognizedTextObservation] else {
            return ""
        }
        
        var output = ""
        for observation in results {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            if !output.isEmpty {
                output.append("\n")
            }
            output.append(topCandidate.string)
        }
        
        return output
    }
}

enum OCRError: Error {
    case invalidImage
    case processingFailed
}
```

#### 3.3.2 Screenshot Capture

**ScreenCapture.swift:**
```swift
import Foundation

@objc public class ScreenCapture: NSObject {
    @objc public func captureScreen(completion: @escaping (String?) -> Void) {
        let tempPath = NSTemporaryDirectory() + "screenshot_\(UUID().uuidString).png"
        
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        task.arguments = ["-i", "-x", tempPath] // Interactive, no sound
        
        task.terminationHandler = { _ in
            DispatchQueue.main.async {
                if FileManager.default.fileExists(atPath: tempPath) {
                    completion(tempPath)
                } else {
                    completion(nil)
                }
            }
        }
        
        do {
            try task.run()
        } catch {
            completion(nil)
        }
    }
}
```

### 3.4 Global Keyboard Shortcuts

#### 3.4.1 Electron Global Shortcut Integration

**main/shortcuts.ts:**
```typescript
import { globalShortcut, app } from 'electron';
import { clipboardModule, ocrModule } from './native-modules';

export class ShortcutManager {
    private shortcuts: Map<string, () => void> = new Map();
    
    constructor() {
        this.registerDefaultShortcuts();
    }
    
    private registerDefaultShortcuts() {
        // Clipboard formatting shortcut (Cmd+Shift+V)
        this.registerShortcut('CommandOrControl+Shift+V', () => {
            this.handleClipboardFormat();
        });
        
        // OCR capture shortcut (Cmd+Shift+2)
        this.registerShortcut('CommandOrControl+Shift+2', () => {
            this.handleOCRCapture();
        });
    }
    
    private registerShortcut(accelerator: string, callback: () => void) {
        const success = globalShortcut.register(accelerator, callback);
        if (success) {
            this.shortcuts.set(accelerator, callback);
            console.log(`Registered global shortcut: ${accelerator}`);
        } else {
            console.error(`Failed to register global shortcut: ${accelerator}`);
        }
    }
    
    private async handleClipboardFormat() {
        try {
            const formattedContent = await clipboardModule.formatClipboard();
            if (formattedContent) {
                await clipboardModule.replaceClipboard(formattedContent);
                // Simulate Cmd+V to paste
                await this.simulatePaste();
            }
        } catch (error) {
            console.error('Clipboard formatting failed:', error);
        }
    }
    
    private async handleOCRCapture() {
        try {
            const imagePath = await ocrModule.captureScreen();
            if (imagePath) {
                const text = await ocrModule.performOCR(imagePath, 'en-US');
                if (text) {
                    await clipboardModule.setClipboard(text);
                }
            }
        } catch (error) {
            console.error('OCR capture failed:', error);
        }
    }
    
    private async simulatePaste() {
        // Use robotjs or native module to simulate Cmd+V
        const { clipboard } = await import('electron');
        // Implementation depends on chosen approach
    }
    
    public unregisterAll() {
        globalShortcut.unregisterAll();
        this.shortcuts.clear();
    }
}
```

### 3.5 Permission Handling

#### 3.5.1 macOS Accessibility Permissions

**permissions.ts:**
```typescript
import { dialog, shell } from 'electron';

export class PermissionManager {
    async checkAccessibilityPermissions(): Promise<boolean> {
        try {
            // Use native module to check AXIsProcessTrusted
            const hasPermission = await this.nativeCheckAccessibility();
            return hasPermission;
        } catch (error) {
            console.error('Failed to check accessibility permissions:', error);
            return false;
        }
    }
    
    async requestAccessibilityPermissions(): Promise<void> {
        const result = await dialog.showMessageBox({
            type: 'info',
            title: 'Accessibility Permission Required',
            message: 'This app requires accessibility permissions to capture global keyboard shortcuts.',
            detail: 'Click "Open System Preferences" to grant permissions.',
            buttons: ['Cancel', 'Open System Preferences'],
            defaultId: 1
        });
        
        if (result.response === 1) {
            await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
        }
    }
    
    async checkScreenRecordingPermissions(): Promise<boolean> {
        // Implementation for screen recording permission check
        return true; // Placeholder
    }
    
    private async nativeCheckAccessibility(): Promise<boolean> {
        // Call native module function
        return true; // Placeholder
    }
}
```

## 4. Development Environment Setup

### 4.1 Required Tools and SDKs

**System Requirements:**
- macOS 12.0 or later (for Vision framework features)
- Xcode 14.0 or later
- Node.js 18.0 or later (N-API compatibility)
- Python 3.8+ (for node-gyp)

**Development Dependencies:**
```json
{
  "devDependencies": {
    "node-gyp": "^10.0.1",
    "electron-rebuild": "^3.2.9",
    "@electron/rebuild": "^3.2.13",
    "node-addon-api": "^7.0.0"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "robotjs": "^0.6.0"
  }
}
```

### 4.2 Build Configuration

**package.json scripts:**
```json
{
  "scripts": {
    "build:native": "node-gyp rebuild",
    "rebuild:electron": "electron-rebuild",
    "postinstall": "npm run rebuild:electron"
  }
}
```

**Electron Builder Configuration:**
```json
{
  "build": {
    "appId": "com.neutralbase.electron-aipaste",
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.inherit.plist"
    },
    "afterSign": "build/notarize.js"
  }
}
```

### 4.3 Testing Setup

**Jest Configuration for Native Modules:**
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000 // For OCR operations
};
```

## 5. Code Examples

### 5.1 Native Module Loading

**main/native-modules.ts:**
```typescript
import { join } from 'path';
import { app } from 'electron';

let clipboardModule: any;
let ocrModule: any;

export async function loadNativeModules() {
    try {
        const nativeModulesPath = app.isPackaged 
            ? join(process.resourcesPath, 'app.asar.unpacked', 'native-modules')
            : join(__dirname, '..', '..', 'native-modules');
            
        clipboardModule = require(join(nativeModulesPath, 'clipboard-monitor'));
        ocrModule = require(join(nativeModulesPath, 'ocr-engine'));
        
        console.log('Native modules loaded successfully');
    } catch (error) {
        console.error('Failed to load native modules:', error);
        throw error;
    }
}

export { clipboardModule, ocrModule };
```

### 5.2 IPC Handler Implementation

**main/ipc-handlers/clipboard.ts:**
```typescript
import { ipcMain } from 'electron';
import { clipboardModule } from '../native-modules';

export function registerClipboardHandlers() {
    ipcMain.handle('clipboard:format', async (event, content: string, format: string) => {
        try {
            return await clipboardModule.formatTable(content, format);
        } catch (error) {
            console.error('Clipboard formatting error:', error);
            throw error;
        }
    });
    
    ipcMain.handle('clipboard:monitor:start', async (event) => {
        return new Promise((resolve, reject) => {
            clipboardModule.startClipboardMonitoring((content: string, format: string) => {
                event.sender.send('clipboard:changed', { content, format });
            });
            resolve(true);
        });
    });
    
    ipcMain.handle('clipboard:monitor:stop', async () => {
        clipboardModule.stopClipboardMonitoring();
        return true;
    });
}
```

### 5.3 OCR Integration Example

**main/ipc-handlers/ocr.ts:**
```typescript
import { ipcMain } from 'electron';
import { ocrModule } from '../native-modules';

export function registerOCRHandlers() {
    ipcMain.handle('ocr:capture-screen', async () => {
        return new Promise((resolve, reject) => {
            ocrModule.captureScreen((imagePath: string | null) => {
                if (imagePath) {
                    resolve(imagePath);
                } else {
                    reject(new Error('Screen capture failed'));
                }
            });
        });
    });
    
    ipcMain.handle('ocr:process-image', async (event, imagePath: string, language: string = 'en-US') => {
        return new Promise((resolve, reject) => {
            ocrModule.performOCR(imagePath, language, (text: string | null, error: Error | null) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(text);
                }
            });
        });
    });
}
```

## 6. Performance Considerations

### 6.1 CPU Usage Optimization

**Clipboard Monitoring:**
- Use event-driven clipboard monitoring instead of polling
- Implement debouncing for rapid clipboard changes
- Cache formatted results to avoid reprocessing identical content

**OCR Processing:**
- Utilize Vision framework's hardware acceleration
- Implement async processing with proper error handling
- Add image preprocessing to improve accuracy and speed

### 6.2 Memory Management

**Native Module Memory:**
- Proper Swift ARC (Automatic Reference Counting) usage
- Cleanup of temporary files after OCR processing
- Efficient image data handling to prevent memory leaks

**JavaScript Side:**
- Use WeakRef for native object references
- Implement proper cleanup in process shutdown handlers
- Monitor memory usage with `process.memoryUsage()`

### 6.3 Background Process Optimization

**Electron Main Process:**
```typescript
// Optimize for background operation
app.dock?.hide(); // Hide from dock on macOS
app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true
});

// Efficient event loop management
process.nextTick(() => {
    // Batch operations
});
```

## 7. Security & Permissions

### 7.1 macOS Entitlements

**entitlements.mac.plist:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.accessibility</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <false/>
    <key>com.apple.security.device.microphone</key>
    <false/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <false/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

### 7.2 Code Signing Configuration

**notarize.js:**
```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== 'darwin') {
        return;
    }

    const appName = context.packager.appInfo.productFilename;

    return await notarize({
        appBundleId: 'com.neutralbase.electron-aipaste',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
    });
};
```

### 7.3 Runtime Permission Checks

**Permission validation flow:**
```typescript
export class SecurityManager {
    async validatePermissions(): Promise<boolean> {
        const permissions = {
            accessibility: await this.checkAccessibility(),
            screenRecording: await this.checkScreenRecording()
        };
        
        if (!permissions.accessibility) {
            await this.requestAccessibility();
            return false;
        }
        
        if (!permissions.screenRecording) {
            await this.requestScreenRecording();
            return false;
        }
        
        return true;
    }
    
    private async checkAccessibility(): Promise<boolean> {
        // Implementation using native module
        return true;
    }
    
    private async requestAccessibility(): Promise<void> {
        // Show permission dialog and guide user
    }
}
```

## 8. Alternatives and Modern Approaches (2024-2025)

### 8.1 Alternative OCR Solutions

**Option 1: Native macOS Vision Framework (Recommended)**
- **Pros**: Best performance, no external dependencies, native integration
- **Cons**: macOS only
- **Implementation**: Swift native module with Vision framework

**Option 2: @cherrystudio/mac-system-ocr**
- **Pros**: Ready-made Node.js wrapper for Vision framework
- **Cons**: Third-party dependency, may have limitations
- **Usage**: `npm install @cherrystudio/mac-system-ocr`

**Option 3: Tesseract.js**
- **Pros**: Cross-platform, JavaScript implementation
- **Cons**: Lower performance, larger bundle size
- **Usage**: Good fallback for cross-platform support

### 8.2 Modern Clipboard Monitoring

**Option 1: node-clipboard-event**
- Event-driven clipboard monitoring
- Better performance than polling
- Cross-platform support

**Option 2: Custom Native Implementation**
- Most efficient for macOS-specific needs
- Full control over functionality
- Requires more development time

### 8.3 Global Shortcut Alternatives

**Option 1: Electron's globalShortcut (Current)**
- Built-in Electron functionality  
- Good for basic shortcuts
- Limited customization

**Option 2: Native Event Tap Implementation**
- Port existing Swift EventTap code
- More flexible shortcut handling
- Requires accessibility permissions

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up native module build environment
- [ ] Create basic Objective-C++ bridge structure
- [ ] Implement simple clipboard monitoring
- [ ] Test N-API integration

### Phase 2: Core Clipboard Features (Week 3-4)
- [ ] Port table formatting logic from PasteManager.swift
- [ ] Implement HTML to pipe-delimited conversion
- [ ] Add clipboard format detection
- [ ] Create IPC handlers for clipboard operations

### Phase 3: Global Shortcuts (Week 5-6)
- [ ] Implement global shortcut handling
- [ ] Add accessibility permission management
- [ ] Port EventTap functionality
- [ ] Test shortcut reliability

### Phase 4: OCR Integration (Week 7-9)
- [ ] Implement Vision framework OCR module
- [ ] Add screen capture functionality
- [ ] Port OCR preferences and language support
- [ ] Integrate QR code detection

### Phase 5: UI Integration (Week 10-11)
- [ ] Create settings interface in Next.js
- [ ] Add permission request dialogs
- [ ] Implement preference management
- [ ] Add system tray integration

### Phase 6: Testing & Polish (Week 12)
- [ ] Comprehensive testing on various macOS versions
- [ ] Performance optimization
- [ ] Code signing and notarization
- [ ] Documentation and deployment

## 10. Risk Mitigation

### 10.1 Technical Risks
- **Native Module Compatibility**: Test across Electron versions
- **Permission Changes**: Monitor macOS updates for permission API changes
- **Performance Issues**: Implement monitoring and optimization

### 10.2 Development Risks
- **Swift/Objective-C++ Complexity**: Allocate extra time for debugging
- **N-API Changes**: Stay updated with Node.js N-API evolution
- **Electron Updates**: Test compatibility with new Electron releases  

### 10.3 Deployment Risks
- **Code Signing Issues**: Test notarization process early
- **Permission Dialogs**: Ensure proper user guidance
- **Auto-update Compatibility**: Test with native modules

## 11. Resources and Documentation

### 11.1 Official Documentation
- [Electron Native Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [Node.js N-API Documentation](https://nodejs.org/api/n-api.html)
- [Swift Package Manager](https://swift.org/package-manager/)
- [macOS Vision Framework](https://developer.apple.com/documentation/vision)

### 11.2 Community Resources
- [electron-rebuild](https://github.com/electron/electron-rebuild)
- [node-addon-api](https://github.com/nodejs/node-addon-api)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [mac-system-ocr](https://github.com/DeJeune/mac-system-ocr)

### 11.3 Example Projects
- [electron-native-code-demos](https://github.com/felixrieseberg/electron-native-code-demos)
- [node-clipboard-event](https://github.com/sudhakar3697/node-clipboard-event)

---

**Next Steps:**
1. Review and approve this technical plan
2. Set up development environment according to Section 4
3. Begin Phase 1 implementation
4. Establish testing procedures for native modules
5. Create continuous integration pipeline for multi-platform testing

**Estimated Timeline:** 12 weeks for full implementation  
**Team Requirements:** 1-2 developers with Swift/Objective-C++ and Node.js experience  
**Success Metrics:** 
- Clipboard formatting accuracy >95%
- OCR accuracy >90% (Vision framework baseline)
- Global shortcuts response time <100ms
- Memory usage <50MB background operation