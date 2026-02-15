# NeutralBase File Provider - Quick Start (Following Alex's Plan)

## 🎯 Goal: Get "Neutral Drive" in Finder Sidebar (Step 1 Only)

Total time: **15 minutes**

---

## Part 1: Create Xcode Project (10 minutes)

### 1. Open Xcode
```bash
open -a Xcode
```

### 2. Create New Project
- **File** → **New** → **Project** (⌘⇧N)
- Select **macOS** tab
- Choose **App**
- Click **Next**

### 3. Project Settings
```
Product Name:             NeutralDrive
Team:                     [Select your team]
Organization Identifier:  com.neutralbase
Bundle Identifier:        com.neutralbase.NeutralDrive
Interface:                SwiftUI
Language:                 Swift
```
- **Uncheck** "Use Core Data"
- **Uncheck** "Include Tests"
- Click **Next**

### 4. Save Location
- Navigate to: `/Users/mohammedisa/Development/App/electron-aipaste/native/file-provider-extension/`
- Click **Create**

---

## Part 2: Add File Provider Extension (5 minutes)

### 5. Add Extension Target
- **File** → **New** → **Target**
- Select **macOS** tab
- Choose **File Provider Extension**
- Click **Next**

### 6. Extension Settings
```
Product Name:             NeutralDriveExtension
Language:                 Swift
Project:                  NeutralDrive
Embed in Application:     NeutralDrive
```
- Click **Finish**

### 7. Activate Scheme
- When prompted "Activate NeutralDriveExtension scheme?"
- Click **Activate**

---

## Part 3: Replace Extension Code (2 minutes)

### 8. Open Extension File
In Xcode Project Navigator (left sidebar):
- Expand **NeutralDriveExtension** folder
- Click on **FileProviderExtension.swift**

### 9. Replace Code
- **Delete all existing code** in that file
- **Copy entire contents** from: `FileProviderExtension-Step1.swift` (in this folder)
- **Paste** into Xcode

### 10. Save
- Press **⌘S** to save

---

## Part 4: Build and Run (3 minutes)

### 11. Select Scheme
- At top of Xcode window
- Click scheme dropdown
- Select **NeutralDrive** (NOT NeutralDriveExtension)

### 12. Build
- **Product** → **Build** (⌘B)
- Wait for "Build Succeeded"

### 13. Run
- **Product** → **Run** (⌘R)
- App window should appear
- Console should show: "✅ File Provider Extension initialized"

---

## Part 5: Verify in Finder (1 minute)

### 14. Open Finder
- Press **⌘Space** → type "Finder" → Enter
- Or click Finder icon in Dock

### 15. Check Sidebar
Look at **Locations** section in Finder sidebar:
```
Locations
├── iCloud Drive
├── Dropbox
├── OneDrive
└── Neutral Drive ⭐ (NEW!)
```

### 16. Click "Neutral Drive"
- Should show **empty folder** (this is correct!)
- Main area says "No items"

---

## ✅ SUCCESS CRITERIA

You should see:
- [x] "Neutral Drive" appears in Finder sidebar under "Locations"
- [x] Can click on it
- [x] Shows empty folder (no files - expected for Step 1!)
- [x] Xcode console shows: "✅ File Provider Extension initialized"

---

## 🎉 Step 1 Complete!

You've successfully completed Alex's Step 1!

**What you have now:**
- ✅ Neutral Drive appears in Finder (like Google Drive)
- ✅ File Provider Extension is working
- ✅ Foundation ready for Steps 2-5

**What's next:**
- Step 2: Show files from Convex database
- Step 3: Implement cloud file downloads
- Step 4: Add APFS clones for local files
- Step 5: Bi-directional sync

---

## 🐛 Troubleshooting

### "Neutral Drive" doesn't appear

**Solution 1: Check System Settings**
- System Settings → Privacy & Security → Extensions
- Look for "File Provider Extensions"
- Enable "Neutral Drive"

**Solution 2: Restart Finder**
```bash
killall Finder
```

**Solution 3: Run app again**
- Sometimes takes 2-3 runs to register
- Just click Run (⌘R) again in Xcode

### Build errors

**Solution: Update deployment target**
- Click project in navigator
- Select both targets (NeutralDrive and NeutralDriveExtension)
- Set **Minimum Deployments** to **macOS 13.0**

---

## 📞 Ready for Step 2?

Once you see "Neutral Drive" in Finder, let me know and we'll implement Step 2:
- Fetch files from your Convex database
- Display them in Finder with metadata
- Show file names, sizes, modification dates

**Time estimate for Step 2**: 30-45 minutes

---

**Current Status**: 🎯 Ready to start Step 1!
