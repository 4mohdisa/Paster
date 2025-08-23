import ArgumentParser
import Foundation
import AppKit

struct AiPasteHelper: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "AI-powered clipboard and OCR processing tool",
        version: "1.0.0",
        subcommands: [
            FormatCommand.self,
            PasteCommand.self,
            MonitorCommand.self,
            SettingsCommand.self,
            ShortcutsCommand.self,
            TriggerPasteCommand.self,
            FinderSelectionCommand.self,
            TestCommand.self
        ]
    )
}

// Test command to verify CLI is working
struct TestCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "test",
        abstract: "Test the CLI is working"
    )

    func run() throws {
        let response = CLIResponse(
            success: true,
            message: "AiPasteHelper is working!",
            data: nil
        )
        print(response.toJSON())
    }
}

// Format command - with proper HTML support
struct FormatCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "format",
        abstract: "Format spreadsheet data with pipe delimiters"
    )

    @Option(name: .short, help: "Input text to format")
    var input: String?

    @Flag(name: .long, help: "Read from stdin")
    var stdin = false

    @Flag(name: .long, help: "Input is HTML")
    var html = false

    @Option(name: .short, help: "Output format: simple, markdown, pretty-printed, html")
    var outputFormat: String = "simple"

    @Flag(name: .long, help: "Disable prefix")
    var noPrefix = false

    @Option(name: .short, help: "Custom prefix text")
    var prefix: String?

    func run() throws {
        var text = ""

        if stdin {
            // Read from stdin
            while let line = readLine() {
                text += line + "\n"
            }
        } else if let input = input {
            text = input
        } else {
            // Check clipboard
            let pasteboard = NSPasteboard.general

            if html, let htmlData = pasteboard.data(forType: .html) {
                text = String(data: htmlData, encoding: .utf8) ?? ""
            } else if let plainString = pasteboard.string(forType: .string) {
                text = plainString
            } else {
                throw ValidationError("No input provided. Use --input, --stdin, or copy to clipboard")
            }
        }

        let formatter = TableFormatter()
        formatter.usePrefixEnabled = !noPrefix

        if let customPrefix = prefix {
            formatter.userDefinedPrefix = customPrefix
        }

        let formatted = formatter.createPasteableContent(
            text,
            isHTML: html,
            outputFormat: outputFormat
        )

        let response = CLIResponse(
            success: true,
            message: "Formatted successfully",
            data: formatted
        )
        print(response.toJSON())
    }
}

// Paste command - complete paste flow (format + update clipboard + trigger paste)
struct PasteCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "paste",
        abstract: "Format clipboard content and trigger paste"
    )

    @Flag(name: .long, help: "Disable prefix")
    var noPrefix = false

    @Option(name: .short, help: "Custom prefix text")
    var prefix: String?

    @Option(name: .short, help: "Output format: simple, markdown, pretty-printed, html")
    var outputFormat: String = "simple"

    @Flag(name: .long, help: "Simulate paste (don't trigger Cmd+V)")
    var simulate = false

    func run() throws {
        let pasteboard = NSPasteboard.general
        let formatter = TableFormatter()
        let settings = SettingsManager.shared
        
        // Use settings if command-line options not provided
        formatter.usePrefixEnabled = noPrefix ? false : settings.usePrefixEnabled
        formatter.userDefinedPrefix = prefix ?? settings.userDefinedPrefix
        // If outputFormat is default "simple", use settings value, otherwise use the provided format
        let actualOutputFormat = outputFormat == "simple" ? settings.outputFormat : outputFormat

        var formattedContent: String?

        // Check for HTML first (Excel/Google Sheets)
        if let htmlData = pasteboard.data(forType: .html),
           let htmlString = String(data: htmlData, encoding: .utf8) {

            // Check if it contains table data
            if htmlString.contains("<table") || htmlString.contains("google-sheets-html-origin") {
                formattedContent = formatter.createPasteableContent(
                    htmlString,
                    isHTML: true,
                    outputFormat: actualOutputFormat
                )
            }
        }

        // If no HTML table, check for tab-delimited plain text
        if formattedContent == nil,
           let plainString = pasteboard.string(forType: .string) {
            
            // Only format if it contains tabs (likely spreadsheet data)
            if plainString.contains("\t") {
                formattedContent = formatter.createPasteableContent(
                    plainString,
                    isHTML: false,
                    outputFormat: actualOutputFormat
                )
            }
        }

        // If we have formatted content, update clipboard and trigger paste
        if let formatted = formattedContent {
            // Update clipboard with formatted content
            pasteboard.clearContents()
            pasteboard.setString(formatted, forType: .string)

            // Trigger system paste unless simulating
            if !simulate {
                triggerSystemPaste()
            }

            let response = CLIResponse(
                success: true,
                message: "Paste executed",
                data: formatted,
                event: "paste-completed"
            )
            print(response.toJSON())
        } else {
            // No spreadsheet data found
            let response = CLIResponse(
                success: false,
                message: "No spreadsheet data found in clipboard",
                error: "No table or tab-delimited data detected"
            )
            print(response.toJSON())
        }
    }

    // Port of performCustomPaste from AppDelegate.swift
    private func triggerSystemPaste() {
        guard let source = CGEventSource(stateID: .hidSystemState) else {
            print("Failed to create CGEventSource")
            return
        }

        // Virtual keycode for 'v' on a US keyboard is 0x09 (9)
        let vKey: CGKeyCode = 0x09

        // Press 'v' key down with Command modifier
        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: true) {
            keyDown.flags = .maskCommand
            keyDown.post(tap: .cghidEventTap)
        }

        // Small delay to ensure key press is registered
        usleep(10000) // 10ms

        // Release 'v' key with Command modifier
        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: false) {
            keyUp.flags = .maskCommand
            keyUp.post(tap: .cghidEventTap)
        }
    }
}

// Trigger paste command - just triggers Cmd+V without formatting
struct TriggerPasteCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "trigger-paste",
        abstract: "Trigger system paste (Cmd+V) without formatting"
    )

    func run() throws {
        // Trigger system paste
        guard let source = CGEventSource(stateID: .hidSystemState) else {
            let response = CLIResponse(
                success: false,
                message: "Failed to create CGEventSource",
                error: "Could not create event source"
            )
            print(response.toJSON())
            return
        }

        // Virtual keycode for 'v' on a US keyboard is 0x09 (9)
        let vKey: CGKeyCode = 0x09

        // Press 'v' key down with Command modifier
        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: true) {
            keyDown.flags = .maskCommand
            keyDown.post(tap: .cghidEventTap)
        }

        // Small delay to ensure key press is registered
        usleep(10000) // 10ms

        // Release 'v' key with Command modifier
        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: false) {
            keyUp.flags = .maskCommand
            keyUp.post(tap: .cghidEventTap)
        }

        let response = CLIResponse(
            success: true,
            message: "System paste triggered",
            data: nil
        )
        print(response.toJSON())
    }
}

// Monitor command - watch clipboard for changes
struct MonitorCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "monitor",
        abstract: "Monitor clipboard for spreadsheet data"
    )

    @Option(name: .short, help: "Check interval in seconds")
    var interval: Double = 0.5

    @Flag(name: .long, help: "Disable prefix")
    var noPrefix = false

    func run() throws {
        let formatter = TableFormatter()
        formatter.usePrefixEnabled = !noPrefix

        var lastChangeCount = NSPasteboard.general.changeCount

        // Send initial status
        let statusResponse = CLIResponse(
            success: true,
            message: "Monitoring clipboard...",
            data: nil
        )
        print(statusResponse.toJSON())
        fflush(stdout)

        // Monitor loop
        Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            let currentChangeCount = NSPasteboard.general.changeCount

            if currentChangeCount != lastChangeCount {
                lastChangeCount = currentChangeCount

                let pasteboard = NSPasteboard.general
                var originalContent: String?
                var formattedContent: String?
                var detectedAs: String = "unknown"
                let settings = SettingsManager.shared

                // Check for HTML first (Excel/Google Sheets)
                if let htmlData = pasteboard.data(forType: .html),
                   let htmlString = String(data: htmlData, encoding: .utf8) {

                    // Check if it contains table data
                    if htmlString.contains("<table") || htmlString.contains("google-sheets-html-origin") {
                        originalContent = htmlString
                        detectedAs = "html-table"
                        formattedContent = formatter.createPasteableContent(
                            htmlString,
                            isHTML: true,
                            outputFormat: settings.outputFormat
                        )
                    }
                }

                // If no HTML table, check for tab-delimited plain text
                if formattedContent == nil,
                   let plainString = pasteboard.string(forType: .string),
                   plainString.contains("\t") {
                    originalContent = plainString
                    detectedAs = "tab-delimited"
                    formattedContent = formatter.createPasteableContent(
                        plainString,
                        isHTML: false,
                        outputFormat: settings.outputFormat
                    )
                }

                // If we have formatted content, send both original and formatted
                if let original = originalContent, let formatted = formattedContent {
                    // Create metadata
                    let metadata: [String: Any] = [
                        "detectedAs": detectedAs,
                        "format": settings.outputFormat,
                        "usePrefixEnabled": settings.usePrefixEnabled
                    ]
                    
                    // Convert to JSON string for data field
                    let dataDict: [String: Any] = [
                        "original": original,
                        "formatted": formatted,
                        "metadata": metadata
                    ]
                    
                    let jsonData = try? JSONSerialization.data(withJSONObject: dataDict)
                    let jsonString = jsonData != nil ? String(data: jsonData!, encoding: .utf8) : nil
                    
                    let response = CLIResponse(
                        success: true,
                        message: "Clipboard change detected",
                        data: jsonString,
                        event: "clipboard-change"
                    )
                    print(response.toJSON())
                    fflush(stdout)
                }
            }
        }

        // Keep the command running
        RunLoop.main.run()
    }
}

// Response structure for clean JSON communication
struct CLIResponse: Codable {
    let success: Bool
    let message: String?
    let data: String?
    let error: String?
    let event: String?

    init(success: Bool, message: String? = nil, data: String? = nil, error: String? = nil, event: String? = nil) {
        self.success = success
        self.message = message
        self.data = data
        self.error = error
        self.event = event
    }

    func toJSON() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        guard let data = try? encoder.encode(self),
              let string = String(data: data, encoding: .utf8) else {
            return "{\"success\": false, \"error\": \"Failed to encode response\"}"
        }
        return string
    }
}

// Entry point
AiPasteHelper.main()