#!/usr/bin/env swift

import Foundation
import FileProvider

print("🚀 Registering Neutral Drive domain...")

// This is the SIMPLEST possible Step 1
// Just register the domain - no extension code yet

let domainIdentifier = NSFileProviderDomainIdentifier(rawValue: "com.neutralbase.drive")
let domain = NSFileProviderDomain(
    identifier: domainIdentifier,
    displayName: "Neutral Drive"
)

let semaphore = DispatchSemaphore(value: 0)

NSFileProviderManager.add(domain) { error in
    if let error = error {
        if (error as NSError).code == NSFileProviderError.providerDomainAlreadyExists.rawValue {
            print("⚠️  Domain already exists - this is actually good!")
            print("✅ Neutral Drive is registered!")
        } else {
            print("❌ Error: \(error.localizedDescription)")
        }
    } else {
        print("✅ Neutral Drive successfully registered!")
    }

    semaphore.signal()
}

semaphore.wait()

print("""

╔════════════════════════════════════════════╗
║     Check Finder Sidebar > Locations       ║
╚════════════════════════════════════════════╝

However, this won't actually work yet because:
- We need a File Provider Extension
- Can't register without the extension bundle

This is just to show the registration API.

""")
