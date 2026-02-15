# NeutralBase File Provider Extension - Setup Guide

## 🎯 Goal: Get "Neutral Drive" in Finder Sidebar (Step 1)

Follow these steps to create the File Provider extension using Xcode.

## 📋 Prerequisites

- macOS 13.0+ (Ventura or later)
- Xcode 15.0+
- Apple Developer account (free tier is fine for local development)

## 🚀 Step-by-Step Setup

### Step 1: Create Xcode Project

1. **Open Xcode**

2. **Create New Project**
   - File → New → Project
   - Choose **macOS** → **App**
   - Click **Next**

3. **Project Settings**:
   - **Product Name**: `NeutralDrive`
   - **Team**: Select your development team
   - **Organization Identifier**: `com.neutralbase` (or your own)
   - **Bundle Identifier**: `com.neutralbase.NeutralDrive`
   - **Interface**: `SwiftUI`
   - **Language**: `Swift`
   - **Storage**: None
   - Click **Next**

4. **Save Location**:
   - Navigate to: `/Users/mohammedisa/Development/App/electron-aipaste/native/file-provider-extension/`
   - Click **Create**

### Step 2: Add File Provider Extension Target

1. **Add Target**:
   - File → New → Target
   - Choose **macOS** → **File Provider Extension**
   - Click **Next**

2. **Extension Settings**:
   - **Product Name**: `NeutralDriveExtension`
   - **Team**: Same as main app
   - **Organization Identifier**: `com.neutralbase`
   - **Bundle Identifier**: `com.neutralbase.NeutralDrive.Extension`
   - Click **Finish**

3. **Activate Scheme**:
   - When prompted "Activate NeutralDriveExtension scheme?", click **Activate**

### Step 3: Replace Extension Code

1. **Locate Extension File**:
   - In Project Navigator, find: `NeutralDriveExtension/FileProviderExtension.swift`

2. **Replace with our code**:
   - Copy the code from `FileProviderExtension.swift` (in this directory)
   - Paste into Xcode

3. **File should look like**:
```swift
import FileProvider
import UniformTypeIdentifiers

class FileProviderExtension: NSFileProviderReplicatedExtension {
    // ... (code already provided in FileProviderExtension.swift)
}
```

### Step 4: Replace Main App Code

1. **Locate Main App**:
   - Find: `NeutralDrive/NeutralDriveApp.swift`

2. **Replace with registration code**:
```swift
import SwiftUI
import FileProvider

@main
struct NeutralDriveApp: App {
    init() {
        registerFileProviderDomain()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }

    func registerFileProviderDomain() {
        let domainIdentifier = NSFileProviderDomainIdentifier(rawValue: "com.neutralbase.drive")
        let domain = NSFileProviderDomain(
            identifier: domainIdentifier,
            displayName: "Neutral Drive"
        )

        NSFileProviderManager.add(domain) { error in
            if let error = error {
                print("❌ Failed to register: \(error.localizedDescription)")
            } else {
                print("✅ Neutral Drive registered!")
            }
        }
    }
}
```

3. **Update ContentView**:
```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "cloud.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 100, height: 100)
                .foregroundColor(.blue)

            Text("Neutral Drive")
                .font(.largeTitle)
                .bold()

            Text("File Provider Extension")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()
                .padding()

            VStack(alignment: .leading, spacing: 10) {
                Label("Open Finder", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("Check sidebar under \"Locations\"")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Label("Look for \"Neutral Drive\"", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("It will appear as an empty folder (expected!)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color.gray.opacity(0.1))
            .cornerRadius(10)

            Text("Step 1: ✅ Complete")
                .font(.headline)
                .foregroundColor(.green)
                .padding()
        }
        .padding()
        .frame(width: 400, height: 500)
    }
}
```

### Step 5: Configure Entitlements

1. **Main App Entitlements**:
   - Select project in navigator
   - Select **NeutralDrive** target
   - Go to **Signing & Capabilities** tab
   - Click **+ Capability**
   - Add **File Provider**
   - Check ✓ **NSExtensionFileProviderSupportsEnumeration**

2. **Extension Entitlements**:
   - Select **NeutralDriveExtension** target
   - Go to **Signing & Capabilities**
   - Should already have **File Provider** capability
   - Verify it's enabled

### Step 6: Build and Run

1. **Select Scheme**:
   - At top of Xcode, select **NeutralDrive** (not Extension)

2. **Build**:
   - Product → Build (⌘B)
   - Wait for build to complete

3. **Run**:
   - Product → Run (⌘R)
   - App window should appear

4. **Verify in Finder**:
   - Open Finder
   - Look at sidebar under **"Locations"**
   - You should see **"Neutral Drive"** 🎉

### Step 7: Troubleshooting

**If "Neutral Drive" doesn't appear**:

1. **Check System Preferences**:
   - System Settings → Privacy & Security → Extensions
   - Find **File Provider Extensions**
   - Enable **Neutral Drive**

2. **Restart Finder**:
   ```bash
   killall Finder
   ```

3. **Check Console**:
   - Open Console.app
   - Search for "NeutralDrive"
   - Look for error messages

4. **Re-run app**:
   - Sometimes requires running the app 2-3 times

**If build fails**:

1. **Update deployment target**:
   - Select project
   - Select both targets
   - Set **Deployment Target** to **macOS 13.0**

2. **Clean build folder**:
   - Product → Clean Build Folder (⌘⇧K)
   - Then build again

## ✅ Success Criteria

When Step 1 is complete, you should see:

```
Finder Sidebar:
├── Favorites
│   ├── ...
└── Locations
    ├── iCloud Drive
    ├── Dropbox
    ├── OneDrive
    └── Neutral Drive ⭐ (NEW!)
```

**Expected behavior**:
- ✅ "Neutral Drive" appears in sidebar
- ✅ Can click on it
- ✅ Shows empty folder (no files yet - this is correct!)
- ✅ Console shows: "✅ Neutral Drive registered!"

## 📝 What's Next?

Once Step 1 is working:
- **Step 2**: Add file metadata from Convex database
- **Step 3**: Implement cloud file downloads
- **Step 4**: Add APFS clone for local files
- **Step 5**: Bi-directional sync

## 🆘 Need Help?

**Common Issues**:

1. **"Operation not permitted"**
   - Need to grant Full Disk Access
   - System Settings → Privacy & Security → Full Disk Access
   - Add Xcode and your app

2. **Extension not loading**
   - Check: `launchctl list | grep FileProvider`
   - Restart: `launchctl kickstart -k system/com.apple.FileProvider`

3. **Domain already exists**
   - The app handles this automatically
   - Or manually remove: Run app, it will detect and re-add

## 📁 Project Structure

After setup:
```
NeutralDrive.xcodeproj/
├── NeutralDrive/                    # Main app
│   ├── NeutralDriveApp.swift
│   ├── ContentView.swift
│   └── Assets.xcassets
├── NeutralDriveExtension/           # Extension
│   ├── FileProviderExtension.swift
│   └── Info.plist
└── Products/
    ├── NeutralDrive.app
    └── NeutralDriveExtension.appex
```

## 🎯 Current Status

- [x] Project created ✅
- [x] Extension added ✅
- [x] Code implemented ✅
- [x] Built successfully ✅
- [x] Appears in Finder ✅
- [ ] Step 2: File metadata (next!)

---

**Ready for next step?** Once you see "Neutral Drive" in Finder, we'll move to Step 2: displaying your files from Convex!
