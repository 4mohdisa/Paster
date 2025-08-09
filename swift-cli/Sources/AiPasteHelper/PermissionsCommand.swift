import Foundation
import ArgumentParser
import AppKit
import CoreGraphics

// Permissions command to check system permissions
struct PermissionsCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "permissions",
        abstract: "Check and request system permissions"
    )

    enum Permission: String, CaseIterable, ExpressibleByArgument {
        case accessibility
        case screenRecording
        case all
    }

    @Argument(help: "Permission to check (accessibility, screenRecording, all)")
    var check: Permission = .all

    @Flag(name: .shortAndLong, help: "Request permission if not granted")
    var request = false

    func run() throws {
        var status: [String: Bool] = [:]

        switch check {
        case .accessibility:
            status["accessibility"] = checkAccessibility()
            if request && !status["accessibility"]! {
                requestAccessibility()
            }

        case .screenRecording:
            status["screenRecording"] = checkScreenRecording()
            if request && !status["screenRecording"]! {
                // Note: Screen recording can't be requested programmatically
                // User must grant in System Preferences
                print(CLIResponse(
                    success: false,
                    message: "Screen recording permission must be granted in System Preferences > Privacy & Security > Screen Recording",
                    data: nil
                ).toJSON())
                return
            }

        case .all:
            status["accessibility"] = checkAccessibility()
            status["screenRecording"] = checkScreenRecording()

            if request && !status["accessibility"]! {
                requestAccessibility()
            }
        }

        // Convert status to JSON string
        let jsonData = try JSONSerialization.data(withJSONObject: status, options: .prettyPrinted)
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

        let response = CLIResponse(
            success: true,
            message: "Permission status",
            data: jsonString
        )
        print(response.toJSON())
    }

    private func checkAccessibility() -> Bool {
        return AXIsProcessTrusted()
    }

    private func checkScreenRecording() -> Bool {
        // Try to capture a small portion of the screen
        // If it succeeds, we have permission
        let displayID = CGMainDisplayID()

        // Try to create a 1x1 pixel screenshot
        if let image = CGDisplayCreateImage(displayID, rect: CGRect(x: 0, y: 0, width: 1, height: 1)) {
            // Successfully created image, we have permission
            return true
        }

        return false
    }

    private func requestAccessibility() {
        // This will prompt the user to grant accessibility permissions
        let options: NSDictionary = [
            kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true
        ]

        let trusted = AXIsProcessTrustedWithOptions(options as CFDictionary)

        if !trusted {
            // Open System Preferences to Accessibility pane
            let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
            NSWorkspace.shared.open(url)

            print(CLIResponse(
                success: false,
                message: "Please grant accessibility permission in System Preferences",
                data: "{\"accessibility\": false, \"requestSent\": true}"
            ).toJSON())
        }
    }
}