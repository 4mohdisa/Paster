# AiPaste Electron - Final Implementation Plan

## Analysis of Original AiPaste Implementation

### How AiPaste Works:

1. **Startup Flow**:
   ```
   App Launch → Check License (skip) → Check Onboarding → Check Permissions → Setup EventTap
   ```

2. **EventTap Implementation**:
   - Uses `EventTapWrapper.swift` singleton
   - Runs in main app process (not separate daemon)
   - Intercepts keyDown events globally
   - Checks for Cmd+Shift+V (customizable)
   - Blocks original event and triggers `performCustomPaste()`

3. **Paste Logic**:
   - Simple: HTML → `convertHTMLToPlainText()`
   - Plain text → passes through unchanged
   - Does NOT use `createPasteableContent()` (that's for manual formatting)

4. **Settings Storage**:
   - Uses `@AppStorage` (UserDefaults wrapper)
   - Keys: outputFormat, usePrefixEnabled, userDefinedPrefix, customShortcutModifiers, customShortcutKeyCode

5. **What They DON'T Have**:
   - No history tracking
   - No paste statistics
   - No export/import settings

---

## Our Implementation Strategy

### Key Differences:
- **CLI-based**: EventTap must run as Swift CLI command
- **Better formatting**: We use `createPasteableContent()` in paste command
- **History tracking**: New feature they don't have
- **Simpler UI**: Dashboard instead of menu bar

### Architecture:
```
Electron App
    ├── Onboarding (permissions check)
    ├── Dashboard (main window)
    └── Spawns CLI processes:
        ├── shortcuts (EventTap daemon)
        ├── monitor (clipboard watcher)
        └── One-shot commands (format, paste, settings)
```

---

## Phase 1: Complete CLI Foundation (2 days)

### 1.1 EventTap/Shortcuts Command ⭐ CRITICAL
```swift
// Port from EventTap.swift + AppDelegate handleEvent logic
struct ShortcutsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "shortcuts",
        abstract: "Monitor global keyboard shortcuts"
    )
    
    func run() throws {
        // Check accessibility first
        guard AXIsProcessTrusted() else {
            print(CLIResponse(
                success: false,
                error: "Accessibility permission required"
            ).toJSON())
            return
        }
        
        // Load shortcut config from settings
        let settings = loadSettings()
        let modifiers = settings["shortcutModifiers"] as? Int ?? 3  // Cmd+Shift
        let keyCode = settings["shortcutKeyCode"] as? Int ?? 9      // V
        
        // Setup EventTap (port EventTapWrapper logic)
        let eventMask = CGEventMask(1 << CGEventType.keyDown.rawValue)
        
        let callback: CGEventTapCallBack = { proxy, type, event, refcon in
            // Check if it's our shortcut
            let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
            let flags = event.flags
            
            let currentModifiers = calculateModifiers(flags)
            
            if keyCode == savedKeyCode && currentModifiers == savedModifiers {
                // Execute paste command in background
                DispatchQueue.global().async {
                    executePasteCommand()
                }
                return nil  // Block original event
            }
            
            return Unmanaged.passRetained(event)
        }
        
        // Create and run EventTap
        guard let tap = CGEvent.tapCreate(...) else {
            throw CLIError("Failed to create event tap")
        }
        
        // Add to run loop and start
        CFRunLoopRun()
    }
}
```

### 1.2 Settings Command
```swift
struct SettingsCommand: ParsableCommand {
    enum Action: String {
        case get, set, list, reset
    }
    
    @Argument var action: Action
    @Option var key: String?
    @Option var value: String?
    
    func run() throws {
        let settingsPath = "~/.aipaste/settings.json"
        
        switch action {
        case .get:
            // Return specific or all settings
        case .set:
            // Update setting and save
        case .list:
            // List available settings with descriptions
        case .reset:
            // Reset to defaults
        }
    }
}

// Default settings:
{
    "outputFormat": "simple",
    "usePrefixEnabled": true,
    "userDefinedPrefix": "Below is a table...",
    "shortcutModifiers": 3,  // Cmd+Shift
    "shortcutKeyCode": 9     // V
}
```

### 1.3 Permissions Command
```swift
struct PermissionsCommand: ParsableCommand {
    enum Permission: String {
        case accessibility, screenRecording, all
    }
    
    @Argument var check: Permission = .all
    @Flag var request = false
    
    func run() throws {
        var status: [String: Bool] = [:]
        
        // Check accessibility
        status["accessibility"] = AXIsProcessTrusted()
        
        // Check screen recording (for future OCR)
        status["screenRecording"] = checkScreenRecording()
        
        if request && !status["accessibility"]! {
            // Open System Preferences
            let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true]
            AXIsProcessTrustedWithOptions(options as CFDictionary)
        }
        
        print(CLIResponse(success: true, data: status).toJSON())
    }
}
```

### 1.4 History Command (NEW!)
```swift
struct HistoryCommand: ParsableCommand {
    enum Action: String {
        case add, list, clear, stats
    }
    
    @Argument var action: Action
    
    func run() throws {
        let historyPath = "~/.aipaste/history.json"
        
        switch action {
        case .add:
            // Add new paste record
            let record = HistoryRecord(
                timestamp: Date(),
                originalLength: original.count,
                formattedLength: formatted.count,
                format: outputFormat,
                hadPrefix: usePrefixEnabled
            )
            
        case .list:
            // Return recent history (last 50)
            
        case .stats:
            // Return statistics
            // Total pastes, most used format, average size, etc.
            
        case .clear:
            // Clear history
        }
    }
}
```

### 1.5 Update Paste Command
```swift
// Add history tracking to existing paste command
struct PasteCommand {
    func run() throws {
        // ... existing paste logic ...
        
        if let formatted = formattedContent {
            // Update clipboard
            pasteboard.clearContents()
            pasteboard.setString(formatted, forType: .string)
            
            // ADD: Track in history
            recordToHistory(original: originalContent, formatted: formatted)
            
            // Trigger paste
            if !simulate {
                triggerSystemPaste()
            }
        }
    }
}
```

---

## Phase 2: Electron UI (2 days)

### 2.1 Simple Onboarding
```tsx
// src/renderer/components/Onboarding.tsx
function Onboarding({ onComplete }) {
    const [permissions, setPermissions] = useState(null);
    
    useEffect(() => {
        checkPermissions();
    }, []);
    
    const checkPermissions = async () => {
        const result = await window.electron.swift.execute(['permissions', 'all']);
        setPermissions(result.data);
    };
    
    const requestPermissions = async () => {
        await window.electron.swift.execute(['permissions', 'all', '--request']);
        // Poll for permission grant
        const interval = setInterval(async () => {
            const result = await window.electron.swift.execute(['permissions', 'all']);
            if (result.data.accessibility) {
                clearInterval(interval);
                setPermissions(result.data);
            }
        }, 1000);
    };
    
    return (
        <div className="p-8">
            <h1>Welcome to AiPaste</h1>
            
            <div className="mt-8">
                <h2>Step 1: Grant Permissions</h2>
                {permissions?.accessibility ? (
                    <div className="text-green-500">✓ Accessibility granted</div>
                ) : (
                    <Button onClick={requestPermissions}>
                        Grant Accessibility Permission
                    </Button>
                )}
            </div>
            
            <div className="mt-8">
                <h2>Step 2: Your Shortcut</h2>
                <div className="p-4 bg-gray-100 rounded">
                    <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>
                </div>
                <p>Use this to format and paste tables</p>
            </div>
            
            {permissions?.accessibility && (
                <Button onClick={onComplete} className="mt-8">
                    Continue to Dashboard
                </Button>
            )}
        </div>
    );
}
```

### 2.2 Dashboard Window
```tsx
// src/renderer/components/Dashboard.tsx
function Dashboard() {
    const [status, setStatus] = useState({ monitoring: false, shortcuts: false });
    const [history, setHistory] = useState([]);
    const [settings, setSettings] = useState({});
    
    useEffect(() => {
        // Start background processes
        startShortcutsProcess();
        loadHistory();
        loadSettings();
    }, []);
    
    const startShortcutsProcess = async () => {
        // Main process spawns: swift-cli shortcuts
        await window.electron.startShortcuts();
        setStatus(prev => ({ ...prev, shortcuts: true }));
    };
    
    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex justify-between">
                    <h1 className="text-2xl font-bold">AiPaste</h1>
                    <div className="flex gap-2">
                        <StatusIndicator label="Shortcuts" active={status.shortcuts} />
                        <StatusIndicator label="Monitoring" active={status.monitoring} />
                    </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                    Press <kbd>Cmd+Shift+V</kbd> to format and paste
                </div>
            </div>
            
            {/* History */}
            <div className="flex-1 p-4 overflow-auto">
                <h2 className="font-semibold mb-2">Recent Pastes</h2>
                <div className="space-y-2">
                    {history.map(item => (
                        <HistoryItem key={item.id} {...item} />
                    ))}
                </div>
            </div>
            
            {/* Settings */}
            <div className="p-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label>Output Format</label>
                        <Select value={settings.outputFormat} onChange={updateSetting}>
                            <option value="simple">Simple</option>
                            <option value="markdown">Markdown</option>
                            <option value="pretty-printed">Pretty</option>
                            <option value="html">HTML</option>
                        </Select>
                    </div>
                    <div>
                        <label>
                            <input 
                                type="checkbox" 
                                checked={settings.usePrefixEnabled}
                                onChange={updateSetting}
                            />
                            Add Prefix
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

### 2.3 Main Process Manager
```typescript
// src/main/process-manager.ts
class ProcessManager {
    private shortcuts: ChildProcess | null = null;
    private monitor: ChildProcess | null = null;
    
    async startShortcuts() {
        // Kill existing if any
        if (this.shortcuts) {
            this.shortcuts.kill();
        }
        
        // Start shortcuts daemon
        this.shortcuts = spawn(swiftBinaryPath, ['shortcuts']);
        
        this.shortcuts.stdout?.on('data', (data) => {
            const response = JSON.parse(data.toString());
            if (response.event === 'shortcut-triggered') {
                // Log to history
                this.addToHistory(response.data);
                
                // Notify renderer
                mainWindow?.webContents.send('paste-completed', response.data);
            }
        });
        
        this.shortcuts.on('error', (error) => {
            console.error('Shortcuts process error:', error);
            // Attempt restart
            setTimeout(() => this.startShortcuts(), 5000);
        });
    }
    
    async addToHistory(data: any) {
        await swiftBridge.execute(['history', 'add', '--data', JSON.stringify(data)]);
    }
}
```

---

## Phase 3: Integration & Testing (1 day)

### 3.1 App Initialization Flow
```typescript
// src/main/index.ts
app.whenReady().then(async () => {
    // 1. Check first run
    const settings = await swiftBridge.execute(['settings', 'get']);
    const isFirstRun = !settings.data || Object.keys(settings.data).length === 0;
    
    // 2. Create window
    createWindow();
    
    // 3. Show onboarding or dashboard
    if (isFirstRun) {
        mainWindow.loadURL('#/onboarding');
    } else {
        mainWindow.loadURL('#/dashboard');
        
        // 4. Start background processes
        await processManager.startShortcuts();
    }
});
```

### 3.2 Settings Sync
```typescript
// Bidirectional settings sync
ipcMain.handle('settings:get', async () => {
    const result = await swiftBridge.execute(['settings', 'get']);
    return result.data;
});

ipcMain.handle('settings:set', async (_, key, value) => {
    await swiftBridge.execute(['settings', 'set', '-k', key, '-v', value]);
    
    // Restart shortcuts if keyboard config changed
    if (key.includes('shortcut')) {
        await processManager.restartShortcuts();
    }
});
```

---

## Implementation Timeline

### Day 1-2: CLI Foundation
- [ ] Port EventTap to shortcuts command
- [ ] Implement settings command
- [ ] Implement permissions command  
- [ ] Add history command
- [ ] Test all CLI commands work

### Day 3-4: Electron UI
- [ ] Create onboarding component
- [ ] Create dashboard component
- [ ] Wire up process management
- [ ] Connect settings to CLI

### Day 5: Integration & Polish
- [ ] Test complete flow
- [ ] Fix any issues
- [ ] Add error handling
- [ ] Package for distribution

---

## Key Success Factors

1. **EventTap Working**: Must intercept Cmd+Shift+V globally
2. **Permissions Flow**: Clear onboarding for accessibility
3. **Process Management**: Keep shortcuts daemon running
4. **Settings Persistence**: Save user preferences
5. **History Tracking**: Show recent pastes

## What We're NOT Doing (Yet)

- Menu bar icon (using window instead)
- License management (not needed)
- Target apps filtering (can add later)
- OCR features (can add later)
- Launch at login (can add later)
- Custom shortcuts UI (hardcoded for now)