# AiPaste Electron - Complete CLI & UI Integration Plan

**Document Version**: 1.0  
**Date**: 2025-08-07  
**Status**: Strategic Planning Document  

---

## Executive Summary

This document outlines all features from the original AiPaste that need CLI implementation and their corresponding UI integration strategy. Each feature is mapped from CLI command to UI component with clear data flow and state management patterns.

---

## 1. Complete CLI Command Architecture

### Existing Commands (Enhanced)
```
AiPasteHelper
├── test          ✅ (works)
├── format        ✅ (enhanced with all output formats)
├── paste         ✅ (complete flow implementation)
├── monitor       ✅ (clipboard watching)
```

### New Commands Needed
```
├── settings      🔄 (get/set persistent settings)
├── shortcuts     🔄 (EventTap keyboard monitoring)  
├── permissions   🔄 (check/request system permissions)
├── target-apps   🔄 (manage target applications)
├── ocr           🔄 (screenshot OCR from TRex)
├── status        🔄 (health check all features)
```

---

## 2. Settings Management System

### CLI: Settings Command

```swift
struct SettingsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "settings",
        abstract: "Manage persistent settings"
    )
    
    enum Action: String, CaseIterable, ExpressibleByArgument {
        case get, set, list, reset
    }
    
    @Argument(help: "Action to perform")
    var action: Action
    
    @Option(name: .short, help: "Setting key")
    var key: String?
    
    @Option(name: .short, help: "Setting value")
    var value: String?
    
    func run() throws {
        let settingsPath = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(".aipaste/settings.json")
        
        switch action {
        case .get:
            // Return specific setting or all settings as JSON
            let settings = loadSettings()
            if let key = key {
                print(CLIResponse(success: true, data: settings[key]).toJSON())
            } else {
                print(CLIResponse(success: true, data: settings.toJSON()).toJSON())
            }
            
        case .set:
            guard let key = key, let value = value else {
                throw ValidationError("Key and value required for set")
            }
            var settings = loadSettings()
            settings[key] = value
            saveSettings(settings)
            
        case .list:
            // List all available settings with descriptions
            let availableSettings = [
                "outputFormat": "Output format (simple, markdown, pretty-printed, html)",
                "usePrefixEnabled": "Enable prefix before table",
                "userDefinedPrefix": "Custom prefix text",
                "shortcutModifiers": "Keyboard shortcut modifiers",
                "shortcutKeyCode": "Keyboard shortcut key",
                "checkInterval": "Clipboard monitoring interval",
                "ocrLanguages": "OCR language preferences"
            ]
            print(CLIResponse(success: true, data: availableSettings).toJSON())
            
        case .reset:
            // Reset to defaults
            resetToDefaults()
        }
    }
}
```

### TypeScript Bridge Integration

```typescript
export class SettingsManager {
    private settings: Map<string, any> = new Map();
    private settingsPath = path.join(app.getPath('userData'), 'settings.json');
    
    async initialize() {
        // Load settings from file
        await this.loadSettings();
        
        // Sync with Swift CLI
        await this.syncWithCLI();
    }
    
    async get(key?: string): Promise<any> {
        if (key) {
            return this.settings.get(key);
        }
        return Object.fromEntries(this.settings);
    }
    
    async set(key: string, value: any): Promise<void> {
        this.settings.set(key, value);
        
        // Persist to file
        await this.saveSettings();
        
        // Sync with Swift CLI
        await swiftBridge.execute(['settings', 'set', '-k', key, '-v', String(value)]);
        
        // Notify UI
        mainWindow.webContents.send('settings:updated', { key, value });
    }
    
    async syncWithCLI(): Promise<void> {
        const result = await swiftBridge.execute(['settings', 'get']);
        if (result.success && result.data) {
            const cliSettings = JSON.parse(result.data);
            Object.entries(cliSettings).forEach(([key, value]) => {
                this.settings.set(key, value);
            });
        }
    }
}
```

### UI Component: Settings Window

```tsx
// src/renderer/components/SettingsWindow.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SettingsWindow() {
    const [settings, setSettings] = useState({
        outputFormat: 'simple',
        usePrefixEnabled: true,
        userDefinedPrefix: 'Below is a table. The symbol "|" denotes a separation in a column: ',
        shortcutModifiers: 'cmd+shift',
        shortcutKey: 'v',
        checkInterval: 500,
        ocrLanguages: ['en']
    });
    
    useEffect(() => {
        // Load settings on mount
        window.electron.settings.get().then(setSettings);
        
        // Listen for settings updates
        window.electron.onSettingsUpdate((newSettings) => {
            setSettings(prev => ({ ...prev, ...newSettings }));
        });
    }, []);
    
    const updateSetting = async (key: string, value: any) => {
        await window.electron.settings.set(key, value);
        setSettings(prev => ({ ...prev, [key]: value }));
    };
    
    return (
        <div className="p-4 w-[600px] h-[500px]">
            <Tabs defaultValue="formatting">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="formatting">Formatting</TabsTrigger>
                    <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
                    <TabsTrigger value="apps">Target Apps</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="formatting" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Output Format</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select 
                                value={settings.outputFormat} 
                                onValueChange={(value) => updateSetting('outputFormat', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="simple">Simple (Pipe-delimited)</SelectItem>
                                    <SelectItem value="markdown">Markdown</SelectItem>
                                    <SelectItem value="pretty-printed">Pretty Printed</SelectItem>
                                    <SelectItem value="html">HTML</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="prefix"
                                    checked={settings.usePrefixEnabled}
                                    onCheckedChange={(checked) => updateSetting('usePrefixEnabled', checked)}
                                />
                                <Label htmlFor="prefix">Add prefix to formatted tables</Label>
                            </div>
                            
                            {settings.usePrefixEnabled && (
                                <Textarea
                                    placeholder="Custom prefix text..."
                                    value={settings.userDefinedPrefix}
                                    onChange={(e) => updateSetting('userDefinedPrefix', e.target.value)}
                                    className="h-20"
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="shortcuts">
                    <ShortcutSettings settings={settings} onUpdate={updateSetting} />
                </TabsContent>
                
                <TabsContent value="apps">
                    <TargetAppsManager />
                </TabsContent>
                
                <TabsContent value="advanced">
                    <AdvancedSettings settings={settings} onUpdate={updateSetting} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
```

---

## 3. Keyboard Shortcuts System

### CLI: Shortcuts Command with EventTap

```swift
struct ShortcutsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "shortcuts",
        abstract: "Monitor global keyboard shortcuts"
    )
    
    @Option(name: .short, help: "Shortcut configuration file")
    var config: String?
    
    func run() throws {
        // Load shortcut configuration
        let settings = loadSettings()
        let modifiers = settings["shortcutModifiers"] as? Int ?? 3  // Cmd+Shift
        let keyCode = settings["shortcutKeyCode"] as? Int ?? 9      // V key
        
        // Setup EventTap
        let eventMask = CGEventMask(1 << CGEventType.keyDown.rawValue)
        
        guard let eventTap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: eventMask,
            callback: { proxy, type, event, refcon in
                return handleKeyEvent(proxy: proxy, type: type, event: event, refcon: refcon)
            },
            userInfo: nil
        ) else {
            throw CLIError("Failed to create event tap. Check accessibility permissions.")
        }
        
        // Start monitoring
        let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: eventTap, enable: true)
        
        // Send ready signal
        print(CLIResponse(success: true, message: "Shortcuts monitoring started").toJSON())
        fflush(stdout)
        
        // Run the event loop
        CFRunLoopRun()
    }
    
    func handleKeyEvent(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent, refcon: UnsafeMutableRawPointer?) -> Unmanaged<CGEvent>? {
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        let flags = event.flags
        
        // Check if it's our shortcut
        if keyCode == savedKeyCode && flags.contains(savedModifiers) {
            // Execute paste command
            DispatchQueue.global().async {
                let result = executePasteCommand()
                print(CLIResponse(
                    success: result,
                    event: "shortcut-triggered",
                    data: "paste"
                ).toJSON())
                fflush(stdout)
            }
            
            // Block the original event
            return nil
        }
        
        // Pass through other events
        return Unmanaged.passRetained(event)
    }
}
```

### UI: Shortcut Configuration Component

```tsx
// src/renderer/components/ShortcutSettings.tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ShortcutSettings({ settings, onUpdate }) {
    const [isRecording, setIsRecording] = useState(false);
    const [currentShortcut, setCurrentShortcut] = useState('Cmd+Shift+V');
    
    const startRecording = () => {
        setIsRecording(true);
        
        // Listen for key combination
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            
            const modifiers = [];
            if (e.metaKey) modifiers.push('Cmd');
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');
            
            const key = e.key.toUpperCase();
            const shortcut = [...modifiers, key].join('+');
            
            setCurrentShortcut(shortcut);
            setIsRecording(false);
            
            // Update settings
            onUpdate('shortcutModifiers', encodeModifiers(modifiers));
            onUpdate('shortcutKeyCode', e.keyCode);
            
            // Remove listener
            window.removeEventListener('keydown', handleKeyDown);
        };
        
        window.addEventListener('keydown', handleKeyDown);
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Keyboard Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                    <Label>Paste with Formatting:</Label>
                    <Input
                        value={isRecording ? 'Press keys...' : currentShortcut}
                        readOnly
                        className="w-32"
                    />
                    <Button onClick={startRecording} disabled={isRecording}>
                        {isRecording ? 'Recording...' : 'Record'}
                    </Button>
                </div>
                
                <Alert>
                    <AlertDescription>
                        This shortcut will intercept clipboard data and format it before pasting.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
}
```

---

## 4. Target Applications Management

### CLI: Target Apps Command

```swift
struct TargetAppsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "target-apps",
        abstract: "Manage target applications for formatting"
    )
    
    enum Action: String, CaseIterable, ExpressibleByArgument {
        case list, add, remove, detect
    }
    
    @Argument(help: "Action to perform")
    var action: Action
    
    @Option(name: .short, help: "Bundle identifier")
    var bundleId: String?
    
    func run() throws {
        let targetAppsPath = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(".aipaste/target-apps.json")
        
        switch action {
        case .list:
            let apps = loadTargetApps()
            print(CLIResponse(success: true, data: apps).toJSON())
            
        case .add:
            guard let bundleId = bundleId else {
                throw ValidationError("Bundle ID required")
            }
            var apps = loadTargetApps()
            if !apps.contains(bundleId) {
                apps.append(bundleId)
                saveTargetApps(apps)
            }
            
        case .remove:
            guard let bundleId = bundleId else {
                throw ValidationError("Bundle ID required")
            }
            var apps = loadTargetApps()
            apps.removeAll { $0 == bundleId }
            saveTargetApps(apps)
            
        case .detect:
            // Detect currently focused app
            if let frontApp = NSWorkspace.shared.frontmostApplication {
                let appInfo = [
                    "name": frontApp.localizedName ?? "Unknown",
                    "bundleId": frontApp.bundleIdentifier ?? "Unknown",
                    "icon": frontApp.icon?.tiffRepresentation?.base64EncodedString() ?? ""
                ]
                print(CLIResponse(success: true, data: appInfo).toJSON())
            }
        }
    }
}
```

### UI: Target Apps Manager

```tsx
// src/renderer/components/TargetAppsManager.tsx
export function TargetAppsManager() {
    const [targetApps, setTargetApps] = useState<TargetApp[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);
    
    const detectCurrentApp = async () => {
        setIsDetecting(true);
        
        // Show instruction
        toast.info('Click on the application you want to add...');
        
        setTimeout(async () => {
            const result = await window.electron.swift.execute(['target-apps', 'detect']);
            if (result.success && result.data) {
                const appInfo = JSON.parse(result.data);
                
                // Add to list
                await window.electron.swift.execute([
                    'target-apps', 'add', 
                    '-b', appInfo.bundleId
                ]);
                
                // Update UI
                setTargetApps(prev => [...prev, appInfo]);
            }
            setIsDetecting(false);
        }, 2000);
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Target Applications</CardTitle>
                <CardDescription>
                    AiPaste will only format clipboard data when pasting into these applications.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {targetApps.map(app => (
                        <div key={app.bundleId} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center space-x-2">
                                {app.icon && <img src={app.icon} className="w-8 h-8" />}
                                <div>
                                    <div className="font-medium">{app.name}</div>
                                    <div className="text-sm text-gray-500">{app.bundleId}</div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeApp(app.bundleId)}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
                
                <Button 
                    className="mt-4 w-full" 
                    onClick={detectCurrentApp}
                    disabled={isDetecting}
                >
                    {isDetecting ? 'Switch to target app...' : 'Add Current Application'}
                </Button>
            </CardContent>
        </Card>
    );
}
```

---

## 5. OCR Feature from TRex

### CLI: OCR Command

```swift
import Vision
import CoreGraphics

struct OCRCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "ocr",
        abstract: "Extract text from screenshots"
    )
    
    @Option(name: .short, help: "Input image path")
    var input: String?
    
    @Flag(name: .long, help: "Take screenshot interactively")
    var screenshot = false
    
    @Option(name: .short, help: "Languages for OCR")
    var languages: [String] = ["en"]
    
    func run() throws {
        var image: CGImage?
        
        if screenshot {
            // Interactive screenshot mode
            image = captureScreenshot()
        } else if let input = input {
            // Load from file
            image = loadImage(from: input)
        } else {
            throw ValidationError("Provide input image or use --screenshot")
        }
        
        guard let cgImage = image else {
            throw CLIError("Failed to load image")
        }
        
        // Perform OCR
        let request = VNRecognizeTextRequest { request, error in
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                return
            }
            
            var extractedText = ""
            for observation in observations {
                guard let topCandidate = observation.topCandidates(1).first else { continue }
                extractedText += topCandidate.string + "\n"
            }
            
            // Check if it's table data
            let isTable = extractedText.contains("\t") || 
                         extractedText.split(separator: "\n").allSatisfy { 
                             $0.components(separatedBy: " ").count > 2 
                         }
            
            let response = CLIResponse(
                success: true,
                data: extractedText,
                metadata: ["isTable": isTable]
            )
            print(response.toJSON())
        }
        
        request.recognitionLanguages = languages
        request.recognitionLevel = .accurate
        
        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])
    }
    
    func captureScreenshot() -> CGImage? {
        // Port screenshot logic from TRex
        let task = Process()
        task.launchPath = "/usr/sbin/screencapture"
        task.arguments = ["-i", "-c"]  // Interactive, to clipboard
        task.launch()
        task.waitUntilExit()
        
        // Get from clipboard
        let pasteboard = NSPasteboard.general
        guard let imageData = pasteboard.data(forType: .tiff),
              let image = NSImage(data: imageData),
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }
        
        return cgImage
    }
}
```

### UI: OCR Integration

```tsx
// src/renderer/components/OCRFeature.tsx
export function OCRFeature() {
    const [extractedText, setExtractedText] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    
    const captureAndOCR = async () => {
        setIsCapturing(true);
        
        // Trigger screenshot
        const result = await window.electron.swift.execute(['ocr', '--screenshot']);
        
        if (result.success && result.data) {
            const parsed = JSON.parse(result.data);
            setExtractedText(parsed.data);
            
            // If it's table data, offer to format
            if (parsed.metadata?.isTable) {
                const formatted = await window.electron.swift.execute([
                    'format', 
                    '--input', parsed.data,
                    '-f', 'simple'
                ]);
                
                if (formatted.success) {
                    // Copy to clipboard
                    await navigator.clipboard.writeText(formatted.data);
                    toast.success('Table formatted and copied!');
                }
            }
        }
        
        setIsCapturing(false);
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>OCR Text Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button 
                    onClick={captureAndOCR}
                    disabled={isCapturing}
                    className="w-full"
                >
                    {isCapturing ? 'Taking screenshot...' : 'Capture Screenshot & Extract Text'}
                </Button>
                
                {extractedText && (
                    <div className="p-4 bg-gray-100 rounded">
                        <pre className="text-sm">{extractedText}</pre>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
```

---

## 6. Permissions Management

### CLI: Permissions Command

```swift
struct PermissionsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "permissions",
        abstract: "Check and request system permissions"
    )
    
    enum Permission: String, CaseIterable, ExpressibleByArgument {
        case accessibility, screenRecording, notifications
    }
    
    @Argument(help: "Permission to check or request")
    var permission: Permission?
    
    @Flag(name: .long, help: "Request permission if not granted")
    var request = false
    
    func run() throws {
        if let permission = permission {
            checkSpecificPermission(permission)
        } else {
            // Check all permissions
            let status = [
                "accessibility": checkAccessibility(),
                "screenRecording": checkScreenRecording(),
                "notifications": checkNotifications()
            ]
            print(CLIResponse(success: true, data: status).toJSON())
        }
    }
    
    func checkAccessibility() -> Bool {
        return AXIsProcessTrusted()
    }
    
    func checkScreenRecording() -> Bool {
        // Check if we can capture the screen
        let displayID = CGMainDisplayID()
        guard let _ = CGDisplayCreateImage(displayID) else {
            return false
        }
        return true
    }
    
    func requestAccessibility() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true]
        AXIsProcessTrustedWithOptions(options as CFDictionary)
    }
}
```

### UI: Onboarding Flow

```tsx
// src/renderer/components/OnboardingFlow.tsx
export function OnboardingFlow() {
    const [currentStep, setCurrentStep] = useState(0);
    const [permissions, setPermissions] = useState({
        accessibility: false,
        screenRecording: false,
        notifications: false
    });
    
    const steps = [
        {
            title: 'Welcome to AiPaste',
            content: <WelcomeStep />
        },
        {
            title: 'Grant Permissions',
            content: <PermissionsStep permissions={permissions} onCheck={checkPermissions} />
        },
        {
            title: 'Configure Shortcuts',
            content: <ShortcutSetupStep />
        },
        {
            title: 'Choose Target Apps',
            content: <TargetAppsSetupStep />
        },
        {
            title: 'Ready to Go!',
            content: <CompletionStep />
        }
    ];
    
    const checkPermissions = async () => {
        const result = await window.electron.swift.execute(['permissions']);
        if (result.success && result.data) {
            setPermissions(JSON.parse(result.data));
        }
    };
    
    useEffect(() => {
        checkPermissions();
    }, []);
    
    return (
        <div className="flex flex-col h-full">
            <Progress value={(currentStep + 1) / steps.length * 100} />
            
            <div className="flex-1 p-8">
                <h2 className="text-2xl font-bold mb-4">{steps[currentStep].title}</h2>
                {steps[currentStep].content}
            </div>
            
            <div className="flex justify-between p-4 border-t">
                <Button
                    variant="outline"
                    onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                    disabled={currentStep === 0}
                >
                    Previous
                </Button>
                
                <Button
                    onClick={() => {
                        if (currentStep === steps.length - 1) {
                            completeOnboarding();
                        } else {
                            setCurrentStep(prev => prev + 1);
                        }
                    }}
                >
                    {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                </Button>
            </div>
        </div>
    );
}
```

---

## 7. Menu Bar Integration

### TypeScript: Menu Bar Manager

```typescript
// src/main/menubar.ts
export class MenuBarManager {
    private tray: Tray | null = null;
    private contextMenu: Menu | null = null;
    
    initialize() {
        // Create tray icon
        this.tray = new Tray(path.join(__dirname, 'assets/icon.png'));
        
        // Build context menu
        this.contextMenu = Menu.buildFromTemplate([
            {
                label: 'Format Clipboard',
                accelerator: 'Cmd+Shift+V',
                click: () => this.formatClipboard()
            },
            {
                label: 'OCR Screenshot',
                accelerator: 'Cmd+Shift+O',
                click: () => this.captureOCR()
            },
            { type: 'separator' },
            {
                label: 'Settings...',
                click: () => this.openSettings()
            },
            {
                label: 'Target Apps...',
                click: () => this.openTargetApps()
            },
            { type: 'separator' },
            {
                label: 'Monitoring',
                type: 'checkbox',
                checked: true,
                click: (item) => this.toggleMonitoring(item.checked)
            },
            { type: 'separator' },
            {
                label: 'About',
                click: () => this.openAbout()
            },
            {
                label: 'Quit',
                accelerator: 'Cmd+Q',
                click: () => app.quit()
            }
        ]);
        
        this.tray.setContextMenu(this.contextMenu);
        
        // Show status in tooltip
        this.updateStatus();
    }
    
    private async formatClipboard() {
        const result = await swiftBridge.execute(['paste']);
        if (result.success) {
            new Notification({
                title: 'AiPaste',
                body: 'Table formatted and pasted!'
            }).show();
        }
    }
    
    private updateStatus() {
        const status = this.isMonitoring ? 'Monitoring clipboard' : 'Paused';
        this.tray?.setToolTip(`AiPaste - ${status}`);
    }
}
```

---

## 8. Status & Health Monitoring

### CLI: Status Command

```swift
struct StatusCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "status",
        abstract: "Check health status of all features"
    )
    
    func run() throws {
        var status: [String: Any] = [:]
        
        // Check permissions
        status["permissions"] = [
            "accessibility": AXIsProcessTrusted(),
            "screenRecording": checkScreenRecording()
        ]
        
        // Check settings
        status["settings"] = loadSettings().count > 0
        
        // Check clipboard
        status["clipboard"] = [
            "available": true,
            "changeCount": NSPasteboard.general.changeCount
        ]
        
        // Check OCR
        status["ocr"] = [
            "available": true,
            "languages": ["en", "es", "fr"]
        ]
        
        // Overall health
        let allGood = (status["permissions"] as? [String: Bool])?.values.allSatisfy { $0 } ?? false
        status["healthy"] = allGood
        
        print(CLIResponse(success: true, data: status).toJSON())
    }
}
```

### UI: Status Indicator

```tsx
// src/renderer/components/StatusIndicator.tsx
export function StatusIndicator() {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    
    useEffect(() => {
        const checkStatus = async () => {
            const result = await window.electron.swift.execute(['status']);
            if (result.success && result.data) {
                setStatus(JSON.parse(result.data));
            }
        };
        
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        
        return () => clearInterval(interval);
    }, []);
    
    if (!status) return <Spinner />;
    
    return (
        <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${status.healthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm">
                {status.healthy ? 'All systems operational' : 'Some features need attention'}
            </span>
        </div>
    );
}
```

---

## 9. Implementation Timeline

### Phase 1: Core CLI Commands (Current)
- ✅ format, paste, monitor, test
- 🔄 settings, permissions, status

### Phase 2: Advanced Features (Next)
- ⏳ shortcuts (EventTap)
- ⏳ target-apps
- ⏳ ocr

### Phase 3: UI Components
- ⏳ Settings Window
- ⏳ Onboarding Flow
- ⏳ Menu Bar
- ⏳ Target Apps Manager

### Phase 4: Integration
- ⏳ IPC handlers for all commands
- ⏳ State synchronization
- ⏳ Error handling
- ⏳ Performance optimization

---

## 10. Pre/Post Hooks Integration

### Pre-Hook Actions
```typescript
// Before any major operation
async function preOperationHook(operation: string) {
    // Check permissions
    const perms = await checkPermissions();
    if (!perms.accessibility && operation === 'shortcuts') {
        throw new Error('Accessibility permission required');
    }
    
    // Load latest settings
    await settingsManager.syncWithCLI();
    
    // Log operation start
    logger.info(`Starting operation: ${operation}`);
}
```

### Post-Hook Actions
```typescript
// After any major operation
async function postOperationHook(operation: string, success: boolean) {
    // Update status
    await updateSystemStatus();
    
    // Save state
    await settingsManager.saveSettings();
    
    // Notify UI
    mainWindow?.webContents.send('operation:complete', { operation, success });
    
    // Log completion
    logger.info(`Operation ${operation} completed: ${success}`);
}
```

---

## Conclusion

This comprehensive plan covers all features from the original AiPaste with:
- **9 CLI commands** (4 existing, 5 new)
- **Complete UI integration** using shadcn/ui
- **State management** between CLI and Electron
- **Full feature parity** with original AiPaste
- **Enhanced capabilities** (OCR from TRex)

The implementation follows a phased approach where each CLI command is built first, then integrated into the UI with proper state management and user feedback mechanisms.