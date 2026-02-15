# NeutralBase File Provider Extension

This is the macOS File Provider extension that makes **Neutral Drive** appear in Finder's sidebar, integrating with your existing Cloudflare R2 + Convex storage backend.

## 🎯 Implementation Progress

- [x] **STEP 1**: Show "Neutral Drive" in Finder sidebar ✅ (Current)
- [ ] **STEP 2**: Display file metadata (names, sizes, thumbnails)
- [ ] **STEP 3**: Implement cloud file downloads (from R2)
- [ ] **STEP 4**: Implement local file APFS clones
- [ ] **STEP 5**: Bi-directional sync for local file edits

## 📦 Project Structure

```
file-provider-extension/
├── Package.swift                           # Swift Package Manager config
├── Sources/
│   ├── NeutralDriveApp/
│   │   └── main.swift                      # Registers domain in Finder
│   └── NeutralDriveExtension/
│       └── FileProviderExtension.swift     # File Provider logic
└── README.md
```

## 🚀 Quick Start (Step 1)

### Prerequisites

- macOS 13.0+ (Ventura or later)
- Xcode 15.0+
- Swift 5.9+

### Build and Run

```bash
# 1. Navigate to extension directory
cd native/file-provider-extension

# 2. Build the project
swift build -c release

# 3. Run the app to register domain
./.build/release/NeutralDriveApp
```

### Expected Output

```
🚀 NeutralBase File Provider - Starting registration...
✅ Neutral Drive successfully registered!

╔════════════════════════════════════════════════════════════╗
║                  NEUTRAL DRIVE REGISTERED                   ║
╚════════════════════════════════════════════════════════════╝

📂 Open Finder and check the sidebar under "Locations"
```

### Verify in Finder

1. Open **Finder**
2. Look at the **sidebar** under "Locations"
3. You should see **"Neutral Drive"** (currently empty)

## 🏗️ Architecture

### How It Works

```
┌─────────────────────────────────────────────┐
│  FINDER (macOS)                             │
│  Sidebar > Locations > Neutral Drive ⭐     │
└─────────────────────────────────────────────┘
                  ↕
     File Provider Framework API
                  ↕
┌─────────────────────────────────────────────┐
│  FileProviderExtension.swift                │
│  • Handles Finder requests                  │
│  • Fetches files from Convex                │
│  • Downloads from R2 / clones local files   │
└─────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────┐
│  LOCAL S3 SERVER (port 9000)                │
│  • Existing Express API                     │
│  • Cloudflare R2 integration                │
│  • Convex database                          │
└─────────────────────────────────────────────┘
```

### Integration with Existing Backend

**Neutral Drive connects to your running infrastructure**:

- ✅ LocalS3Server (port 9000) - Already running
- ✅ Convex database - Already storing file metadata
- ✅ Cloudflare R2 - Already storing large files
- ✅ Local storage (~/.neutralbase/) - Already storing small files

**Nothing changes in your backend** - the File Provider just adds a Finder interface on top!

## 📝 Implementation Notes (Step 1)

### What's Implemented

- ✅ Domain registration (`com.neutralbase.drive`)
- ✅ Root container item (the "Neutral Drive" folder)
- ✅ Minimal extension scaffold
- ✅ Required File Provider protocol methods (stubbed)

### What's NOT Implemented Yet

- ❌ File enumeration (Step 2)
- ❌ File metadata display (Step 2)
- ❌ File downloads (Step 3)
- ❌ APFS clones (Step 4)
- ❌ Edit synchronization (Step 5)

### Current Behavior

- **Finder sidebar**: Shows "Neutral Drive"
- **Opening folder**: Shows empty (no files listed)
- **File operations**: Not supported yet

This is expected! We're building incrementally following Alex's plan.

## 🔄 Next Steps

### To Implement Step 2 (File Metadata)

1. Create `ConvexClient.swift` to fetch files from database
2. Implement `FileProviderEnumerator` to list files
3. Create `FileProviderItem` to represent each file
4. Add metadata (filename, size, modification date)

### Commands to Build Next Features

```bash
# Create Convex client
touch Sources/NeutralDriveExtension/ConvexClient.swift

# Create enumerator
touch Sources/NeutralDriveExtension/FileProviderEnumerator.swift

# Create item model
touch Sources/NeutralDriveExtension/FileProviderItem.swift
```

## 🐛 Troubleshooting

### "Domain already registered" error

```bash
# Remove existing domain
# Run this Swift code or restart the app
```

### Extension not appearing in Finder

1. Check System Preferences > Extensions > File Provider
2. Ensure "Neutral Drive" is enabled
3. Restart Finder: `killall Finder`

### Build errors

```bash
# Clean build
swift package clean
swift build -c release
```

## 📚 Resources

- [Apple File Provider Documentation](https://developer.apple.com/documentation/fileprovider)
- [NSFileProviderReplicatedExtension](https://developer.apple.com/documentation/fileprovider/nsfileproviderreplicatedextension)
- [Building a File Provider Extension](https://developer.apple.com/documentation/fileprovider/building_a_file_provider_extension)

## 🎓 Learning Notes

**Why NSFileProviderReplicatedExtension?**
- Modern API introduced in macOS 13
- Better performance than legacy APIs
- Supports incremental sync
- Required for modern File Provider features

**Why Swift Package Manager?**
- Simpler than Xcode projects for CLI tools
- Easy to integrate with existing monorepo
- Familiar to developers who use npm/pnpm

## 🤝 Integration Points

### With Existing Codebase

This extension integrates with:
- **LocalS3Server** (`apps/live-app/src/s3-service/`) - Will add File Provider endpoints
- **Convex** (`convex/`) - Already stores file metadata
- **R2 Service** (`apps/live-app/src/s3-service/R2Service.ts`) - Will download cloud files

### File Storage Locations

- **Cloud files**: Cloudflare R2 bucket (`electron-app-storage`)
- **Local files**: `~/.neutralbase/s3-metadata/`
- **File Provider cache**: `~/Library/CloudStorage/Neutral-Drive/`

## 📊 Progress Checklist

- [x] Create Swift package structure
- [x] Implement minimal File Provider extension
- [x] Register domain with system
- [x] Verify "Neutral Drive" appears in Finder
- [ ] Fetch files from Convex (Step 2)
- [ ] Display file metadata (Step 2)
- [ ] Implement cloud downloads (Step 3)
- [ ] Implement APFS clones (Step 4)
- [ ] Implement bi-directional sync (Step 5)

---

**Current Status**: ✅ Step 1 Complete - Neutral Drive appears in Finder sidebar!
