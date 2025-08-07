import ArgumentParser
import Foundation
import AppKit

struct AiPasteHelper: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "AI-powered clipboard and OCR processing tool",
        version: "1.0.0",
        subcommands: [
            FormatCommand.self,
            MonitorCommand.self,
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
    
    @Option(name: .short, help: "Output format: simple, markdown, html, pretty")
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
                var formattedContent: String?
                
                // Check for HTML first (Excel/Google Sheets)
                if let htmlData = pasteboard.data(forType: .html),
                   let htmlString = String(data: htmlData, encoding: .utf8) {
                    
                    // Check if it contains table data
                    if htmlString.contains("<table") || htmlString.contains("google-sheets-html-origin") {
                        formattedContent = formatter.createPasteableContent(
                            htmlString,
                            isHTML: true,
                            outputFormat: "simple"
                        )
                    }
                }
                
                // If no HTML table, check for tab-delimited plain text
                if formattedContent == nil,
                   let plainString = pasteboard.string(forType: .string),
                   plainString.contains("\t") {
                    formattedContent = formatter.createPasteableContent(
                        plainString,
                        isHTML: false,
                        outputFormat: "simple"
                    )
                }
                
                // If we have formatted content, send it
                if let formatted = formattedContent {
                    let response = CLIResponse(
                        success: true,
                        message: "Clipboard formatted",
                        data: formatted,
                        event: "clipboard-formatted"
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