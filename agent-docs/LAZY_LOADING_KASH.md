# Lazy Loading Kash Implementation

## Overview
AiPaste now implements a **lazy-loading architecture** for Kash document processing features. Instead of bundling Python and packages during build time, the app ships with only the `uv` package manager and installs Kash on-demand when users first need document features.

## Benefits
- **50% smaller app bundle** (~50MB reduction)
- **Faster initial download** for users
- **User control** over which features to install
- **Progressive enhancement** - core paste features work immediately
- **Flexible updates** - can update Kash independently

## Architecture

### Before (Build-time Installation)
```
App Bundle [100MB+]
├── Electron App
├── Swift CLI
└── Python Environment with Kash pre-installed
```

### After (Lazy Loading)
```
App Bundle [~50MB]
├── Electron App
├── Swift CLI  
└── uv binary only

Post-Installation (user-triggered):
└── ~/.aipaste/
    ├── kash-env/     # Created by uv
    └── kash-actions.json  # Tracks installed features
```

## Implementation Components

### 1. uv Binary Embedding (`scripts/embed-uv.js`)
- Downloads correct architecture (x64/arm64) for macOS
- Embeds in `electron/resources/bin/`
- ~13MB binary that manages Python installations

### 2. Kash Installer (`electron/main/kash-installer.ts`)
- Manages Python environment creation
- Installs selected packages
- Tracks installed actions
- Provides uninstall capability

### 3. Onboarding UI (`apps/main-window/src/components/KashOnboarding.tsx`)
- Shows available document features
- Allows users to select which to install
- Displays progress during installation
- Can be triggered manually or automatically

### 4. Modified Python Bridge (`electron/main/python-bridge.ts`)
- Checks for Kash installation before running
- Returns `needsInstallation` flag when not installed
- Prompts user to install missing features

### 5. IPC Handlers (`electron/main/ipc-handlers/kash-installer.ts`)
- `kash:check-installation` - Check if installed
- `kash:install` - Install with progress updates
- `kash:uninstall` - Remove Kash environment

## Available Actions

### 1. Document Conversion (`markdownify`)
- Converts DOCX, HTML, PDF to Markdown
- Packages: python-docx, docx2txt, markdownify, beautifulsoup4
- Size: ~25MB
- Default: Yes

### 2. Document Summarization (`summarize`)
- Creates bullet-point summaries
- Packages: kash (when available)
- Size: ~15MB
- Default: No

### 3. HTML Stripping (`strip_html`)
- Removes HTML tags from content
- Packages: beautifulsoup4, lxml
- Size: ~10MB
- Default: No

## User Experience Flow

### First Launch
1. App opens normally (fast, small)
2. Document features show "Setup Required" badge
3. Core paste features work immediately

### Using Document Feature
1. User clicks document conversion button
2. Onboarding modal appears:
   - Shows available features with descriptions
   - Displays estimated download size
   - Allows selection of features
3. User clicks "Install Selected Features"
4. Progress bar shows installation status
5. Installation completes in 30-60 seconds
6. Features are now available

### Subsequent Launches
- Kash already installed
- Features work immediately
- Can add/remove actions in settings

## Build Process Changes

### Development
```bash
# Normal development (without Kash)
pnpm dev

# Development with pre-installed Kash (for testing)
pnpm dev:with-kash
```

### Production Build
```bash
# Embeds uv binary, does NOT install Kash
pnpm build

# The embed:uv script runs automatically
pnpm embed:uv
```

## Installation Directory Structure
```
~/.aipaste/
├── kash-env/
│   ├── bin/
│   │   └── python          # Python executable
│   ├── lib/
│   │   └── python3.11/
│   │       └── site-packages/  # Installed packages
│   └── pyvenv.cfg
└── kash-actions.json       # Tracks installed features
```

## Technical Details

### Python Version
- Uses Python 3.11 for compatibility
- Installed via uv's Python management

### Package Installation
- Uses `uv pip install` for package management
- Installs to user's home directory for permissions
- Packages are installed based on selected actions

### Error Handling
- Network failures: Retry logic built-in
- Partial installations: Can resume or retry
- Permission issues: Installs in user directory

## Migration from Old System

### For Existing Installations
- Old `kash-env` in resources remains for compatibility
- New installations use lazy-loading
- Both can coexist during transition

### For Developers
- Keep `build:kash` script for development testing
- Use `dev:with-kash` when testing document features
- Production builds automatically use lazy-loading

## Future Improvements
1. **Incremental Updates**: Update individual packages
2. **Feature Discovery**: Show new Kash features as they become available
3. **Offline Installation**: Cache packages for offline install
4. **Custom Actions**: Allow users to install custom Python packages

## Troubleshooting

### Installation Fails
- Check internet connection
- Ensure sufficient disk space (~100MB)
- Check `~/.aipaste/` permissions

### Features Not Working
- Verify installation: Check Settings → Document Features
- Reinstall: Settings → Document Features → Reinstall
- Check logs: `~/Library/Logs/AiPaste/`

### Uninstalling
- Settings → Document Features → Uninstall
- Removes `~/.aipaste/kash-env/`
- Preserves workspace data