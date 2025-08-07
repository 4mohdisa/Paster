import Foundation
import ArgumentParser

// Settings command for persistent configuration
struct SettingsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "settings",
        abstract: "Manage persistent settings"
    )
    
    enum Action: String, CaseIterable, ExpressibleByArgument {
        case get, set, list, reset
    }
    
    @Argument(help: "Action to perform (get, set, list, reset)")
    var action: Action
    
    @Option(name: .shortAndLong, help: "Setting key")
    var key: String?
    
    @Option(name: .shortAndLong, help: "Setting value")
    var value: String?
    
    func run() throws {
        let settingsManager = SettingsManager.shared
        
        switch action {
        case .get:
            if let key = key {
                // Get specific setting
                let value = settingsManager.get(key: key)
                let response = CLIResponse(
                    success: value != nil,
                    message: value != nil ? "Setting retrieved" : "Setting not found",
                    data: value != nil ? "\(value!)" : nil
                )
                print(response.toJSON())
            } else {
                // Get all settings
                let allSettings = settingsManager.getAllSettings()
                let jsonData = try JSONSerialization.data(withJSONObject: allSettings, options: .prettyPrinted)
                let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                
                let response = CLIResponse(
                    success: true,
                    message: "All settings",
                    data: jsonString
                )
                print(response.toJSON())
            }
            
        case .set:
            guard let key = key, let value = value else {
                throw ValidationError("Both --key and --value are required for set action")
            }
            
            settingsManager.set(key: key, value: value)
            
            let response = CLIResponse(
                success: true,
                message: "Setting updated",
                data: "\(key)=\(value)"
            )
            print(response.toJSON())
            
        case .list:
            // List available settings with descriptions
            let availableSettings: [String: String] = [
                "outputFormat": "Output format (simple, markdown, pretty-printed, html)",
                "usePrefixEnabled": "Enable prefix before table (true/false)",
                "userDefinedPrefix": "Custom prefix text",
                "shortcutModifiers": "Keyboard shortcut modifiers (1=Cmd, 2=Shift, 4=Option, 8=Control)",
                "shortcutKeyCode": "Keyboard shortcut key code (9=V)"
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: availableSettings, options: .prettyPrinted)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
            
            let response = CLIResponse(
                success: true,
                message: "Available settings",
                data: jsonString
            )
            print(response.toJSON())
            
        case .reset:
            settingsManager.resetToDefaults()
            
            let response = CLIResponse(
                success: true,
                message: "Settings reset to defaults"
            )
            print(response.toJSON())
        }
    }
}

// Settings manager singleton
class SettingsManager {
    static let shared = SettingsManager()
    
    private let settingsDirectory: URL
    private let settingsFile: URL
    private var settings: [String: Any] = [:]
    
    // Default settings matching original AiPaste
    private let defaultSettings: [String: Any] = [
        "outputFormat": "simple",
        "usePrefixEnabled": true,
        "userDefinedPrefix": "Below is a table. The symbol \"|\" denotes a separation in a column: ",
        "shortcutModifiers": 3,  // Cmd (1) + Shift (2) = 3
        "shortcutKeyCode": 9      // V key
    ]
    
    private init() {
        // Setup ~/.aipaste directory
        let homeDirectory = FileManager.default.homeDirectoryForCurrentUser
        settingsDirectory = homeDirectory.appendingPathComponent(".aipaste")
        settingsFile = settingsDirectory.appendingPathComponent("settings.json")
        
        // Create directory if it doesn't exist
        createDirectoryIfNeeded()
        
        // Load existing settings or create defaults
        loadSettings()
    }
    
    private func createDirectoryIfNeeded() {
        if !FileManager.default.fileExists(atPath: settingsDirectory.path) {
            try? FileManager.default.createDirectory(
                at: settingsDirectory,
                withIntermediateDirectories: true,
                attributes: nil
            )
        }
    }
    
    private func loadSettings() {
        if FileManager.default.fileExists(atPath: settingsFile.path) {
            // Load existing settings
            if let data = try? Data(contentsOf: settingsFile),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                settings = json
            } else {
                // Corrupted file, use defaults
                settings = defaultSettings
                saveSettings()
            }
        } else {
            // No settings file, create with defaults
            settings = defaultSettings
            saveSettings()
        }
    }
    
    private func saveSettings() {
        if let data = try? JSONSerialization.data(withJSONObject: settings, options: .prettyPrinted) {
            try? data.write(to: settingsFile)
        }
    }
    
    func get(key: String) -> Any? {
        return settings[key]
    }
    
    func set(key: String, value: String) {
        // Convert value to appropriate type based on key
        switch key {
        case "usePrefixEnabled":
            settings[key] = (value.lowercased() == "true" || value == "1")
        case "shortcutModifiers", "shortcutKeyCode":
            settings[key] = Int(value) ?? settings[key] ?? defaultSettings[key]!
        default:
            settings[key] = value
        }
        saveSettings()
    }
    
    func getAllSettings() -> [String: Any] {
        return settings
    }
    
    func resetToDefaults() {
        settings = defaultSettings
        saveSettings()
    }
    
    // Convenience getters for common settings
    var outputFormat: String {
        return settings["outputFormat"] as? String ?? "simple"
    }
    
    var usePrefixEnabled: Bool {
        return settings["usePrefixEnabled"] as? Bool ?? true
    }
    
    var userDefinedPrefix: String {
        return settings["userDefinedPrefix"] as? String ?? defaultSettings["userDefinedPrefix"] as! String
    }
    
    var shortcutModifiers: Int {
        return settings["shortcutModifiers"] as? Int ?? 3
    }
    
    var shortcutKeyCode: Int {
        return settings["shortcutKeyCode"] as? Int ?? 9
    }
}