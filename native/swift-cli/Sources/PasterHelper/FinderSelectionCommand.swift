import Foundation
import AppKit
import ArgumentParser

struct FinderSelectionCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "finder-selection",
        abstract: "Get currently selected files in Finder"
    )
    
    @Flag(name: .long, help: "Monitor selection changes continuously")
    var monitor = false
    
    func run() throws {
        if monitor {
            startMonitoring()
        } else {
            let paths = getSelectedPaths()
            let response = CLIResponse(
                success: true,
                message: "Selected files retrieved",
                data: paths.isEmpty ? nil : paths.joined(separator: "\n")
            )
            print(response.toJSON())
        }
    }
    
    private func getSelectedPaths() -> [String] {
        // Check if Finder is the frontmost application
        guard let frontApp = NSWorkspace.shared.frontmostApplication,
              frontApp.bundleIdentifier == "com.apple.finder" else {
            return []
        }
        
        // Use AppleScript to get selected files
        let script = """
            tell application "Finder"
                set selectedItems to selection
                set pathList to {}
                repeat with anItem in selectedItems
                    set end of pathList to POSIX path of (anItem as alias)
                end repeat
                return pathList
            end tell
        """
        
        var error: NSDictionary?
        guard let scriptObject = NSAppleScript(source: script) else {
            return []
        }
        
        let result = scriptObject.executeAndReturnError(&error)
        
        // Check if execution was successful
        guard error == nil else {
            return []
        }
        
        var paths: [String] = []
        for i in 1...result.numberOfItems {
            if let path = result.atIndex(i)?.stringValue {
                paths.append(path)
            }
        }
        
        return paths
    }
    
    private func startMonitoring() {
        var lastPaths: [String] = []
        
        // Send initial status
        let statusResponse = CLIResponse(
            success: true,
            message: "Monitoring Finder selection...",
            data: nil,
            event: "monitoring-started"
        )
        print(statusResponse.toJSON())
        fflush(stdout)
        
        // Monitor loop
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            let currentPaths = getSelectedPaths()
            
            // Only emit if selection changed
            if currentPaths != lastPaths {
                lastPaths = currentPaths
                
                let response = CLIResponse(
                    success: true,
                    message: "Selection changed",
                    data: currentPaths.isEmpty ? nil : currentPaths.joined(separator: "\n"),
                    event: "finder-selection-changed"
                )
                print(response.toJSON())
                fflush(stdout)
            }
        }
        
        // Keep the command running
        RunLoop.main.run()
    }
}