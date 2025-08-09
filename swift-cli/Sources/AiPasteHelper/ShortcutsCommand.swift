import Foundation
import ArgumentParser
import AppKit
import CoreGraphics
import Carbon.HIToolbox.Events

// EventTap handler class (needs to be a class for Unmanaged)
class ShortcutHandler {
    let debug: Bool

    init(debug: Bool = false) {
        self.debug = debug
    }

    func handleEvent(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        // Handle different event types
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            // The tap can be disabled under certain circumstances
            // We need to re-enable it when this happens
            return Unmanaged.passRetained(event)
        }

        guard type == .keyDown else {
            return Unmanaged.passRetained(event)
        }

        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        let flags = event.flags

        // Calculate current modifiers
        let commandPressed = flags.contains(.maskCommand)
        let shiftPressed = flags.contains(.maskShift)
        let optionPressed = flags.contains(.maskAlternate)
        let controlPressed = flags.contains(.maskControl)

        let currentModifiers =
            (commandPressed ? 1 : 0) |
            (shiftPressed ? 2 : 0) |
            (optionPressed ? 4 : 0) |
            (controlPressed ? 8 : 0)

        if debug {
            let debugInfo: [String: Any] = [
                "keyCode": keyCode,
                "modifiers": currentModifiers,
                "cmd": commandPressed,
                "shift": shiftPressed,
                "option": optionPressed,
                "control": controlPressed
            ]

            if let jsonData = try? JSONSerialization.data(withJSONObject: debugInfo),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                let response = CLIResponse(
                    success: true,
                    message: "Key event",
                    data: jsonString,
                    event: "key-debug"
                )
                print(response.toJSON())
                fflush(stdout)
            }
        }

        // Check if it's our target shortcut
        let settings = SettingsManager.shared
        if keyCode == CGKeyCode(settings.shortcutKeyCode) && currentModifiers == settings.shortcutModifiers {
            // Execute paste command in background
            DispatchQueue.global(qos: .userInitiated).async {
                self.executePasteCommand()
            }

            // Block the original event
            return nil
        }

        // Pass through other events
        return Unmanaged.passRetained(event)
    }

    private func executePasteCommand() {
        // Create a Process to run the paste command
        let process = Process()
        process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
        process.arguments = ["paste"]

        let pipe = Pipe()
        process.standardOutput = pipe

        do {
            try process.run()
            process.waitUntilExit()

            // Read the output
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                // Parse the paste command response
                if let jsonData = output.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                   let success = json["success"] as? Bool {

                    // Send event notification
                    let response = CLIResponse(
                        success: success,
                        message: success ? "Paste executed via shortcut" : "Paste failed",
                        data: json["data"] as? String,
                        event: "shortcut-triggered"
                    )
                    print(response.toJSON())
                    fflush(stdout)
                }
            }
        } catch {
            let response = CLIResponse(
                success: false,
                message: "Failed to execute paste command",
                error: error.localizedDescription,
                event: "shortcut-error"
            )
            print(response.toJSON())
            fflush(stdout)
        }
    }
}

// Shortcuts command to monitor global keyboard shortcuts
struct ShortcutsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "shortcuts",
        abstract: "Monitor global keyboard shortcuts for paste formatting"
    )

    @Flag(name: .shortAndLong, help: "Debug mode - print all keypress events")
    var debug = false

    func run() throws {
        // NO PERMISSION CHECK - Electron handles this before starting this process

        // Load settings for shortcut configuration
        let settings = SettingsManager.shared
        let targetModifiers = settings.shortcutModifiers
        let targetKeyCode = settings.shortcutKeyCode

        // Send initial status
        let statusResponse = CLIResponse(
            success: true,
            message: "Shortcuts monitoring started",
            data: "{\"modifiers\": \(targetModifiers), \"keyCode\": \(targetKeyCode)}"
        )
        print(statusResponse.toJSON())
        fflush(stdout)

        // Create handler instance
        let handler = ShortcutHandler(debug: debug)

        // Setup EventTap
        let eventMask = CGEventMask(1 << CGEventType.keyDown.rawValue)

        // Create EventTap callback
        let callback: CGEventTapCallBack = { proxy, type, event, refcon in
            guard let refcon = refcon else { return Unmanaged.passRetained(event) }

            let handler = Unmanaged<ShortcutHandler>.fromOpaque(refcon).takeUnretainedValue()
            return handler.handleEvent(proxy: proxy, type: type, event: event)
        }

        // Create the event tap
        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: eventMask,
            callback: callback,
            userInfo: Unmanaged.passUnretained(handler).toOpaque()
        ) else {
            let response = CLIResponse(
                success: false,
                message: "Failed to create event tap",
                error: "Could not create CGEventTap"
            )
            print(response.toJSON())
            return
        }

        // Add to run loop
        let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        // Run the event loop
        CFRunLoopRun()
    }
}