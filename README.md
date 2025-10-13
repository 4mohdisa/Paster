# AiPaste Monorepo

A macOS desktop application that provides intelligent clipboard management with table formatting, OCR capabilities, and keyboard shortcuts. Built as a monorepo with Electron, Next.js, and a native Swift CLI for macOS integration.

## 📋 Table of Contents
- [Quick Start](#-quick-start)
- [Architecture Overview](#-architecture-overview) 
- [Development Guide](#-development-guide)
- [Available Commands](#available-commands)
- [Troubleshooting](#troubleshooting)
- [FAQ for Developers](#faq-for-developers)
- [How to Use AiPaste](#-how-to-use-aipaste)

## 🚀 Quick Start

### TL;DR for Experienced Developers
```bash
# Clone and setup
git clone <repository-url> && cd electron-aipaste
pnpm install

# Build Swift CLI (required)
pnpm build:swift

# Start development
pnpm dev
```

### Prerequisites

- **Node.js 20+** (Required - v20.0.0 or higher)
- **pnpm 9.15+** (Required package manager)
- **Xcode Command Line Tools** (for Swift compilation)
- **macOS** (required for native clipboard and permissions features)
- **Git**
- **No Python required** - UV is embedded automatically during build

### Full Installation Guide

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd electron-aipaste
   ```

2. **Ensure you have the correct Node version**
   ```bash
   node --version  # Should be v20.0.0 or higher
   ```
   If not, install Node 20+ using [nvm](https://github.com/nvm-sh/nvm) or [volta](https://volta.sh/):
   ```bash
   # Using nvm
   nvm install 20
   nvm use 20
   
   # Or using volta
   volta install node@20
   ```

3. **Install pnpm if not already installed**
   ```bash
   npm install -g pnpm@9.15.0
   ```

4. **Install dependencies**
   ```bash
   pnpm install
   ```
   > Note: This will automatically download the Convex backend binary (~100MB) during postinstall.

5. **Build the Swift CLI** (Required first!)
   ```bash
   pnpm build:swift
   ```
   
   If you get Swift errors, ensure Xcode Command Line Tools are installed:
   ```bash
   xcode-select --install
   ```

6. **Document Conversion Setup**
   > UV (Python package manager) is embedded automatically during `pnpm build`
   > Kash document processor installs automatically during onboarding (REQUIRED)

### Development

#### First Time Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Build Swift CLI (required)
pnpm build:swift

# 3. Start development environment
pnpm dev

# 4. In a SEPARATE terminal, sync Convex schema (IMPORTANT!)
pnpm convex:dev
```

> **⚠️ IMPORTANT**: You MUST run `pnpm convex:dev` in a separate terminal to sync your Convex schema with the local database. Without this, data operations will fail!

#### Daily Development Workflow

**Starting fresh (recommended for clean state):**
```bash
# Cleans everything and starts fresh
pnpm fresh     # Removes all build artifacts, databases, caches
pnpm dev       # Start the app
# In another terminal:
pnpm convex:dev  # Sync Convex schema
```

**Quick start (when resuming work):**
```bash
pnpm dev         # Start the app
# In another terminal:
pnpm convex:dev  # Sync Convex schema
```

#### Understanding Dev vs Prod Paths

During development, the app uses different paths than production:

| Component | Development Path | Production Path |
|-----------|-----------------|-----------------|
| Convex DB | `.convex-dev-db/` (project root) | `~/Library/Application Support/AiPaste/aipaste-convex-db/` |
| Settings | `.aipaste-settings.json` (project root) | `~/Library/Application Support/AiPaste/settings.json` |
| Kash Env | `electron/resources/kash-env/` | Same (bundled with app) |
| Logs | Console output | `~/Library/Logs/AiPaste/` |

> **Why separate paths?** 
> - Easy cleanup with `pnpm fresh`
> - No pollution of production data
> - Safe testing without affecting installed app

#### The Fresh Command

Use `pnpm fresh` when you need a clean slate:
- After pulling new changes
- When onboarding flow needs testing
- If you encounter strange state issues
- To test first-time user experience

What it cleans:
- All build artifacts (`dist/`, `build/`, `.next/`)
- Development database (`.convex-dev-db/`)
- Development settings (`.aipaste-settings.json`)
- Node modules (optional, if you choose)
- User data in Application Support (optional, if you choose)

#### Common Development Tasks

**Testing onboarding flow:**
```bash
pnpm fresh  # Reset to fresh state
pnpm dev
# Complete onboarding in the app
```

**Working on Convex schema:**
```bash
# Make changes to convex/ files
# The running `pnpm convex:dev` will auto-sync
# Check the Convex dashboard at http://localhost:52100
```

**Testing Swift CLI changes:**
```bash
# Make changes to native/swift-cli/
pnpm build:swift  # Rebuild
# Restart the app (Ctrl+C and pnpm dev)
```

**Testing production build:**
```bash
pnpm build  # Build everything
pnpm dist   # Create distributable
# Find the .dmg in electron/dist/
```

#### What Happens When You Run `pnpm dev`

1. **Cleanup phase**: Kills any existing Electron/Swift processes
2. **Parallel builds**: Three apps build simultaneously:
   - Electron backend (with embedded UV for Kash)
   - Main window (Next.js with Turbopack)
   - Menubar app (Vite + React)
3. **Convex backend**: Needs manual start with `pnpm convex:dev` (separate terminal)
4. **Menubar appears**: Look for the AiPaste icon in your system tray/menubar
5. **Swift CLI ready**: Clipboard monitoring active in background

#### How to Use the Development App

1. **Look for the menubar icon** (top right of your screen)
2. **Click the icon** to see the menu:
   - Quick Paste options
   - Open Dashboard
   - Settings
3. **Click "Dashboard"** to open the main window where you can:
   - Complete onboarding (first launch)
   - Configure settings
   - View clipboard history
   - Manage document conversion

On first launch, the dashboard will guide you through:
- Granting Accessibility permissions (required for keyboard shortcuts)
- Testing clipboard functionality
- Configuring table formatting preferences
- Installing Kash for document support (REQUIRED - happens automatically)

#### Developer Troubleshooting

**"Cannot find Convex client" or data operations fail:**
- You forgot to run `pnpm convex:dev` in a separate terminal
- Solution: Open new terminal, run `pnpm convex:dev`

**Menubar icon doesn't appear:**
- Check if process is actually running: `ps aux | grep AiPaste`
- Try `pnpm fresh` to clean state
- Check console for errors

**"Onboarding already completed" but want to test it:**
- Run `pnpm fresh` to reset everything
- Or manually: `rm .aipaste-settings.json`

**Changes to Swift code not taking effect:**
- Must rebuild: `pnpm build:swift`
- Then restart the app (Ctrl+C and `pnpm dev`)

**Convex schema changes not syncing:**
- Make sure `pnpm convex:dev` is running
- Check http://localhost:52100 for Convex dashboard
- If stuck, restart both `pnpm dev` and `pnpm convex:dev`

**Kash installation hanging during onboarding:**
- Check network connection (downloads ~200MB)
- Check UV is embedded: `ls electron/resources/bin/uv`
- Try `pnpm embed:uv` to re-download UV

**Port conflicts:**
- Next.js will auto-increment from 3000 to 3001, 3002, etc.
- Convex needs port 52100 free
- Kill conflicting processes or change ports

## 🏗️ Architecture Overview

### Technology Stack
- **Electron 36** - Desktop application framework
- **Next.js 15** (App Router) - UI framework with Turbopack
- **Swift** - Native macOS functionality (clipboard, OCR, shortcuts)
- **Convex** - Local backend for data persistence
- **Kash** - Document conversion framework (with embedded Python runtime)
- **TypeScript** - Primary language for Electron and UI
- **pnpm Workspaces** - Monorepo management

### How It Works
1. **Swift CLI** handles all native macOS operations:
   - Clipboard monitoring and formatting
   - Keyboard shortcuts via EventTap
   - OCR functionality
   - System permissions

2. **Electron Main Process** orchestrates:
   - Swift CLI process management
   - IPC communication between processes
   - Convex backend lifecycle
   - Window management

3. **Next.js UI** provides:
   - Settings and configuration
   - Clipboard history view
   - Onboarding flow
   - Real-time updates via IPC

4. **Kash Environment** enables:
   - Word/PDF document conversion
   - Advanced text processing
   - Standalone Python runtime via embedded UV (no system Python needed)

### Key Design Decisions
- **Minimal Swift code** - Only for macOS-specific features
- **TypeScript for business logic** - Easier to maintain and debug
- **JSON-based IPC** - Type-safe communication between Swift and TypeScript
- **Local Convex backend** - Privacy-first, no cloud dependency
- **Monorepo structure** - Shared code and consistent tooling

## 👨‍💻 Development Guide

### Common Development Workflows

#### Starting Fresh Development
```bash
# After cloning or switching branches
pnpm install
pnpm dev
```

#### After Pulling Changes
```bash
# If package.json changed
pnpm install

# If Swift code changed
pnpm build:swift

# Start development
pnpm dev
```

#### Working on Specific Parts
```bash
# Just the UI (Next.js)
cd apps/main-window && pnpm dev

# Just the Electron backend
cd electron && pnpm dev

# Swift CLI development
pnpm build:swift
./.build/release/AiPasteHelper test
```

#### Before Committing
```bash
# Check types
pnpm typecheck

# Check linting
pnpm lint

# Test full build
pnpm build
```

### Project Conventions
- **Package naming**: All packages use `@aipaste/*` namespace
- **Dependencies**: Use `workspace:*` for internal packages
- **Swift output**: Always return JSON for IPC communication
- **Error handling**: Log to electron-log, show user-friendly messages
- **File paths**: Use absolute paths in configs

### Important File Locations

#### Configuration
- `electron/main/config/paths.ts` - All path configurations
- `convex.json` - Convex backend config
- `pnpm-workspace.yaml` - Monorepo workspace config

#### Swift CLI
- `native/swift-cli/Sources/AiPasteHelper/` - Swift source code
- `native/swift-cli/.build/release/AiPasteHelper` - Built binary

#### IPC Communication
- `electron/main/ipc-handlers/` - Electron IPC handlers
- `electron/main/swift-bridge.ts` - Swift process communication
- `electron/preload/index.ts` - Preload API exposed to renderer

#### UI Components
- `apps/main-window/app/` - Next.js app router pages
- `packages/ui/src/` - Shared UI components
- `apps/main-window/components/` - App-specific components

#### Logs & Data
- `~/Library/Logs/@aipaste/electron/` - Application logs
- `~/Library/Application Support/@aipaste/electron/` - User data
- `./convex_local_backend.sqlite3` - Local Convex database

### Debugging Tips

#### View Logs
```bash
# Electron main process logs
tail -f ~/Library/Logs/@aipaste/electron/main.log

# Swift CLI output (in dev mode)
# Look for "debug swift-cli" in terminal output

# Convex backend logs
# Look for "convex-backend" in terminal output
```

#### Test Swift CLI Directly
```bash
# Build Swift CLI
pnpm build:swift

# Test clipboard formatting
echo -e "Name\tAge\nJohn\t30" | ./.build/release/AiPasteHelper format --stdin

# Test settings
./.build/release/AiPasteHelper settings get

# Test permissions
./.build/release/AiPasteHelper permissions check
```

#### Reset Everything
```bash
# Nuclear option - removes everything
pnpm clean:all

# Just reset Kash
pnpm clean:kash

# Reset user data (while app is closed)
rm -rf ~/Library/Application\ Support/@aipaste
rm -rf ~/Library/Logs/@aipaste
```

### Troubleshooting

#### Common Issues

1. **"command not found: pnpm"**
   ```bash
   npm install -g pnpm@9.15.0
   ```

2. **"Node version requirement not satisfied"**
   - Install Node 20+ (see Prerequisites above)

3. **Swift build fails**
   ```bash
   # Ensure Xcode Command Line Tools are installed
   xcode-select --install
   
   # Verify Swift is available
   swift --version
   ```

4. **"Port 3000 is in use"**
   - The app will automatically use port 3001
   - Or kill the process using port 3000:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

5. **Convex backend download fails**
   - Delete the resources folder and reinstall:
   ```bash
   rm -rf electron/resources/bin
   pnpm install
   ```

6. **"Cannot find module '@aipaste/...'"**
   - This is a monorepo using pnpm workspaces. Ensure you run `pnpm install` from the root directory, not from subdirectories.

7. **Build errors in development**
   - Clean and rebuild:
   ```bash
   pnpm clean:fresh  # This removes all node_modules and reinstalls
   pnpm dev
   ```

8. **Kash environment build fails**
   - UV binary is embedded during `pnpm build` (downloads ~20MB)
   - No Python or pipx installation required
   - Kash installs automatically during app onboarding (~200MB)
   - Creates isolated Python environment in `electron/resources/kash-env/`

### Available Commands

#### 🚀 Development
```bash
pnpm dev          # Start all services (Convex local, Electron, Next.js)
pnpm dev:fresh    # Clean everything and start fresh development
```

#### 🔨 Building & Distribution
```bash
pnpm build        # Build everything (Swift, Next.js, Electron)
pnpm build:swift  # Build Swift CLI in release mode
pnpm dist         # Build and package Electron app for distribution
pnpm dist:prod    # Build production Electron app (requires code signing)
```

#### ✅ Code Quality
```bash
pnpm typecheck    # Run TypeScript type checking on all packages
pnpm lint         # Run linting on all packages
```

#### 🧹 Cleanup
```bash
pnpm clean        # Clean build artifacts in all packages
pnpm clean:all    # Nuclear option - removes everything and reinstalls
pnpm clean:kash   # Remove Kash Python environment only
```

#### 🗄️ Convex Backend (Local)
```bash
pnpm convex:dev    # Start local Convex backend (auto-started by pnpm dev)
pnpm convex:deploy # Deploy functions to local Convex backend
```

### Command Usage Guide

#### For Daily Development
1. **First time setup**: Run installation steps above
2. **Regular development**: `pnpm dev`
3. **After pulling changes**: `pnpm install` then `pnpm dev`
4. **Issues with deps**: `pnpm dev:fresh`

#### For Building & Distribution
1. **Test build locally**: `pnpm build`
2. **Create distributable**: `pnpm dist`
3. **Production release**: `pnpm dist:prod` (requires code signing)

#### For Troubleshooting
- **Type errors**: `pnpm typecheck`
- **Dependency issues**: `pnpm clean:all`
- **Kash issues**: `pnpm clean:kash` (reinstalls during onboarding)
- **Swift issues**: `pnpm build:swift`

### Project Structure

```
electron-aipaste/
├── apps/
│   ├── main-window/      # Next.js 15 UI (@aipaste/main-window)
│   └── menubar/          # Future menubar app
├── electron/             # Electron backend (@aipaste/electron)
│   ├── main/            # Main process code
│   ├── preload/         # Preload scripts
│   └── resources/       # Binaries and assets
├── native/
│   └── swift-cli/       # Swift CLI (@aipaste/swift-cli)
├── packages/
│   ├── ui/              # Shared UI components (@aipaste/ui)
│   └── config-typescript/ # TypeScript configs
├── convex/              # Convex backend functions
└── agent-docs/          # Documentation
```

## FAQ for Developers

### Why Swift + Electron instead of pure Electron?
macOS requires native code for:
- Accessibility permissions (keyboard shortcuts)
- EventTap API (global hotkeys)
- Proper clipboard monitoring
- OCR with Vision framework

### Why Kash/Python for document conversion?
- Best-in-class libraries for Word/PDF processing
- Standalone environment (no Python installation needed)
- Consistent conversion across machines

### Why local Convex instead of cloud?
- Privacy-first approach
- No internet required
- Full control over user data
- Faster response times

### How does IPC work between Swift and Electron?
1. Electron spawns Swift CLI as child process
2. Communication via stdin/stdout with JSON messages
3. TypeScript interfaces ensure type safety
4. All Swift commands return `{ success: boolean, data?: any, error?: string }`

### Can I run this without building everything?
No, you need:
- Swift CLI for clipboard operations (required)
- Kash environment for document conversion (required)
- Convex backend for data persistence (auto-starts)

### Where should I add new features?
- **Native macOS feature** → `native/swift-cli/Sources/`
- **UI/UX changes** → `apps/main-window/app/`
- **Business logic** → `electron/main/`
- **Data models** → `convex/schema.ts`
- **Shared UI components** → `packages/ui/src/`

### How do I test in production mode?
```bash
pnpm dist        # Creates .app in electron/dist/mac-arm64/
open electron/dist/mac-arm64/AiPaste.app
```

## 📖 How to Use AiPaste

### 🚀 Getting Started

1. **First Launch**: The app will open an onboarding window
2. **Grant Permissions**: Click "Request Permissions" to enable:
   - **Accessibility**: Required for the Cmd+Shift+V keyboard shortcut
   - **Screen Recording**: May be needed for some clipboard operations
3. **Test Functionality**: The app will verify everything is working
4. **Choose Settings**: Pick your preferred table format and options

### 🎯 Basic Usage (Automatic Clipboard Formatting)

AiPaste works automatically in the background - no manual intervention needed!

1. **Copy Any Table**: 
   - Copy data from Excel, Google Sheets, Numbers, or any spreadsheet
   - Copy HTML tables from websites
   - Copy tab-delimited text from anywhere

2. **Automatic Detection**: 
   - AiPaste detects when you copy tabular data
   - It automatically formats the data based on your preferences
   - The formatted version replaces your clipboard content

3. **Paste Anywhere**: 
   - Use Cmd+V to paste the beautifully formatted table
   - Works in Slack, Discord, emails, documentation, anywhere!

### ⌨️ Using Keyboard Shortcuts

**Cmd+Shift+V** - Access Clipboard History

1. **Press the shortcut** while in any application
2. **Browse your history** - see all previously formatted tables
3. **Click any item** to copy it back to your clipboard
4. **Paste normally** with Cmd+V in your target application

### 📋 Working with Clipboard History

The history panel shows:
- **Formatted content preview**
- **Original timestamp** when you copied it
- **Format type** (Simple, Markdown, Pretty, HTML)
- **Click to copy** - instantly copies the item back to clipboard

### ⚙️ Customizing Your Experience

**Access Settings**: Click the settings icon in the dashboard or history panel

**Format Options**:
- **Simple**: Clean tab-delimited format (great for plain text)
- **Markdown**: GitHub-style tables (perfect for documentation)  
- **Pretty**: ASCII art tables with borders (nice for Slack/Discord)
- **HTML**: Full HTML markup (for web pages and rich text)

**Prefix Options**:
- Enable: Adds "Below is a table showing..." before your data
- Disable: Just the raw formatted table

**Process Management**:
- Start/Stop the background monitoring
- View real-time status
- Health monitoring

### 💡 Common Use Cases

- **Excel → Slack/Discord**: Auto-formats with borders for chat apps
- **Google Sheets → Documentation**: Markdown tables for GitHub/Notion
- **Website Tables → Email**: Clean conversion without messy HTML
- **Quick Reuse**: Press Cmd+Shift+V to access any previous table

### 🎨 Format Examples

**Markdown** (for documentation):
```
| Name | Age | City     |
|------|-----|----------|
| John | 30  | New York |
```

**Pretty** (for chat apps):
```
┌──────┬─────┬──────────┐
│ Name │ Age │ City     │
├──────┼─────┼──────────┤
│ John │ 30  │ New York │
└──────┴─────┴──────────┘
```

### 💡 Tips

**Performance**:
- The app uses minimal CPU when monitoring clipboard
- History is stored locally and privately
- No data ever leaves your computer

**Format Selection**:
- Use **Markdown** for documentation and GitHub
- Use **Pretty** for Slack, Discord, or terminal output  
- Use **Simple** for basic text applications
- Use **HTML** when pasting into rich text editors

**Managing History**:
- History persists in local Convex database (SQLite)
- Items show timestamps for easy identification
- Most recent items appear at the top
- Data stored locally at ~/Library/Application Support/@aipaste/electron/

**Troubleshooting**:
- If shortcuts stop working, check accessibility permissions
- If formatting seems off, try copying the original data again
- Use the dashboard to monitor real-time status

## 🏗️ Monorepo Structure

```
├── apps/
│   ├── main-window/     # Next.js UI (@aipaste/main-window)
│   └── menubar/        # Future menubar app
├── electron/           # Electron backend (@aipaste/electron)
│   ├── main/          # Main process
│   │   ├── swift-bridge.ts    # Swift CLI integration
│   │   └── process-manager.ts # Process management
│   └── preload/       # Preload scripts
├── native/            # Native modules
│   └── swift-cli/     # Swift CLI (@aipaste/swift-cli)
│       ├── Sources/   # Swift source code
│       │   └── AiPasteHelper/  # Main CLI implementation
│       └── Package.swift       # Swift package configuration
├── packages/          # Shared packages
│   ├── ui/           # UI components (@aipaste/ui)
│   └── config-typescript/ # Shared TypeScript configs
├── agent-docs/       # Development documentation and reports
├── convex/           # Convex backend functions and schema
│   ├── _generated/   # Auto-generated Convex types
│   ├── clipboardHistory.ts # Clipboard history functions
│   ├── settings.ts   # Settings management functions
│   └── schema.ts     # Database schema definition
└── pnpm-workspace.yaml # Workspace configuration
```

## 🛠️ Swift CLI Integration

AiPaste uses a native Swift CLI to handle macOS-specific features that require low-level system access.

### Building the Swift CLI

```bash
# Build for development (from root)
pnpm build:swift

# Or manually (if needed)
cd native/swift-cli && swift build -c release
```

### Available CLI Commands

```bash
# Test CLI functionality
./.build/release/AiPasteHelper test

# Format clipboard data (stdin)
echo -e "Name\tAge\nJohn\t30" | ./.build/release/AiPasteHelper format --stdin

# Monitor clipboard changes (long-running)
./.build/release/AiPasteHelper monitor

# Execute paste with formatting
./.build/release/AiPasteHelper paste

# Manage settings
./.build/release/AiPasteHelper settings get
./.build/release/AiPasteHelper settings set prefix true

# Check system permissions
./.build/release/AiPasteHelper permissions

# Start keyboard shortcut monitoring
./.build/release/AiPasteHelper shortcuts
```

### Swift CLI Features

- **Table Formatting**: Converts tabular data from Excel/Google Sheets to various formats
- **Clipboard Monitoring**: Real-time detection of clipboard changes
- **Keyboard Shortcuts**: System-wide Cmd+Shift+V support
- **Settings Management**: JSON-based configuration
- **Permissions Checking**: Accessibility and screen recording permissions

### Communication Protocol

The Swift CLI communicates with Electron using JSON over stdout/stdin:

```typescript
// Electron → Swift CLI
spawn('AiPasteHelper', ['format', '--input', data])

// Swift CLI → Electron (JSON response)
{
  "success": true,
  "data": "formatted table data",
  "message": "Table formatted successfully"
}
```

## 📦 Monorepo Commands

### Package-specific Commands

```bash
# Run command in specific package
pnpm --filter @aipaste/electron <command>
pnpm --filter @aipaste/main-window <command>
pnpm --filter @aipaste/swift-cli <command>

# Examples
pnpm --filter @aipaste/electron build
pnpm --filter @aipaste/main-window dev
pnpm --filter @aipaste/ui add react-hook-form

# Run command in all packages
pnpm run --parallel <command>
```

### Common Development Commands

```bash
# Development (starts all apps)
pnpm dev

# Build all packages
pnpm build

# Build distribution
pnpm dist

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Clean all build artifacts
pnpm clean
```

## 🔧 Technologies

- **Frontend**: Next.js 15, React 19, TypeScript
- **Desktop**: Electron 36
- **Native Backend**: Swift CLI with macOS system integration
- **Database**: Convex (local SQLite backend)
- **Authentication**: Clerk / Better Auth (configurable)
- **AI**: Anthropic Claude / OpenAI (configurable)
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: Zustand + Convex React hooks
- **Build**: tsup, electron-builder, Swift Package Manager

## ✨ Key Features

### 📋 Intelligent Clipboard Management
- **Real-time Monitoring**: Automatically detects when you copy tabular data from Excel, Google Sheets, or any application
- **Auto-formatting**: Instantly converts tables to clean, readable formats
- **Multiple Formats**: Choose from Simple, Markdown, Pretty Table, or HTML formats
- **Smart Prefixes**: Optional descriptive text like "Below is a table showing..."

### ⌨️ Keyboard Shortcuts
- **Cmd+Shift+V**: Global shortcut to paste from clipboard history
- **System Integration**: Works across all applications system-wide
- **Permission Management**: Guided setup for Accessibility permissions

### 📊 Table Formatting Options
- **Simple**: Clean tab-delimited format
- **Markdown**: GitHub-style markdown tables
- **Pretty**: ASCII art tables with borders
- **HTML**: Full HTML table markup

### 💾 Clipboard History
- **Persistent Storage**: All formatted items saved in local Convex database
- **Real-time Updates**: Live synchronization with Convex subscriptions
- **Click to Copy**: Easy access to previous clipboard items
- **Auto-formatting**: Historical items show in your preferred format
- **Metadata Tracking**: Timestamps and format information
- **Offline-first**: Works completely offline with local database

### ⚙️ Settings & Configuration
- **Format Preferences**: Set your default table format
- **Prefix Control**: Enable/disable descriptive prefixes
- **Process Management**: Start/stop background monitoring
- **Permission Status**: Real-time permission monitoring

### 🖥️ Native macOS Integration
- **Swift CLI**: High-performance native backend
- **System Permissions**: Proper Accessibility and Screen Recording integration
- **Background Processing**: Minimal CPU usage with efficient monitoring
- **Auto-restart**: Robust process management with health monitoring

## 📝 Environment Variables

### Required Variables

```env
# Authentication
AUTH_SECRET=your-auth-secret

# Database
POSTGRES_URL="postgresql://postgres:password@localhost:5434/neutralbase_app"
```

### Optional Variables

The template includes additional features that require these variables:

```env
# Authentication Provider (choose one)
AUTH_PROVIDER=clerk # or better-auth
NEXT_PUBLIC_AUTH_PROVIDER=clerk # or better-auth

# Clerk (if using)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key

# Better Auth (if using)
BETTER_AUTH_SECRET=your-better-auth-secret
BETTER_AUTH_URL=your-better-auth-url

# Redis
REDIS_URL=your-redis-url

# File Storage
BLOB_READ_WRITE_TOKEN=your-blob-token

# Licensing (if using)
POLAR_ACCESS_TOKEN=your-polar-token
POLAR_SERVER=sandbox

# Usage Tracking (if using)
METRONOME_BEARER_TOKEN=your-metronome-token

# API
NEXT_PUBLIC_API_URL=your-api-url
```

## 🚀 Available Scripts

### Development
- `pnpm dev` - Start full app with Convex, Electron, and Next.js
- `pnpm dev:no-convex` - Start without Convex (for testing)
- `pnpm dev:electron` - Start only Electron
- `pnpm dev:main-window` - Start only Next.js

### Swift CLI
- `pnpm build:swift` - Build the Swift CLI component

### Convex Backend
- `pnpm convex:dev` - Start local Convex backend (auto-runs with `pnpm dev`)
- `pnpm convex:push` - Deploy functions to local backend
- `pnpm convex:dev:cloud` - Use cloud Convex (if configured)
- `pnpm convex:push:cloud` - Deploy to cloud Convex

### Building
- `pnpm build` - Build everything (Swift CLI + Electron + Next.js)
- `pnpm dist` - Build and package the complete application

### Database (Convex)
Convex functions are automatically deployed when running `pnpm dev`. The local database is stored at:
- **macOS**: `~/Library/Application Support/@aipaste/electron/aipaste-convex-db/`
- **Database**: SQLite file managed by Convex OSS backend
- **Port**: 52100 (backend), 52101 (actions)

### Code Quality
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Run TypeScript type checking

### Setup
- `pnpm setup` - Run automated setup script
- `pnpm setup:interactive` - Run interactive setup script
- `pnpm setup:validate` - Validate setup configuration

## 🧪 Testing the Application

### Quick Swift CLI Test
```bash
# Build the CLI first
pnpm build:swift

# Test basic functionality
./.build/release/AiPasteHelper test

# Test table formatting
echo -e "Name\tAge\nJohn\t30\nJane\t25" | ./.build/release/AiPasteHelper format --stdin -o markdown
```

### Full Integration Test
1. **Start the app**: `pnpm run dev`
2. **Complete onboarding**: Grant permissions when prompted
3. **Test clipboard formatting**: Copy a table from Excel or Google Sheets
4. **Test keyboard shortcut**: Press `Cmd+Shift+V` to access clipboard history
5. **Check settings**: Use the settings panel to configure formats

## 🗃️ Database Setup

The application uses Convex OSS backend with a local SQLite database for persistent storage.

### Convex Backend Features
- **Local-first**: All data stored locally, no cloud dependency
- **Real-time**: Live updates with Convex subscriptions
- **Auto-restart**: Process manager ensures backend stays running
- **Unique Ports**: Uses 52100-52101 to avoid conflicts
- **Auto-deploy**: Functions automatically deployed in development

### Database Location
```
~/Library/Application Support/@aipaste/electron/
├── aipaste-convex-db/       # SQLite database
├── convex-local-backend/    # Convex binary
└── settings.json           # App settings
```

## 🔌 Data Persistence

The application uses Convex for all data persistence needs:
- **Clipboard History**: Stored in Convex with real-time sync
- **Settings**: Managed through Convex functions
- **No External Dependencies**: Everything runs locally

## 📱 Building for Production

### Build the application
```bash
pnpm run build
```

### Create distribution packages
```bash
pnpm run dist
```

### Platform-specific builds
```bash
# Debian package
pnpm run electron:dist:deb
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Troubleshooting

### Swift CLI Issues

**Swift build fails**: 
- Ensure Xcode is installed: `xcode-select --install`
- Check Swift version: `swift --version` (requires 5.9+)
- Try cleaning: `cd swift-cli && swift package clean && swift build`

**AiPasteHelper not found**:
- Build the CLI first: `pnpm build:swift`
- Check binary exists: `ls -la swift-cli/.build/release/AiPasteHelper`
- Verify permissions: `chmod +x swift-cli/.build/release/AiPasteHelper`

**Permission issues**:
- Grant Accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility
- Add the Electron app or Terminal to the allowed apps list
- For Screen Recording permissions, add to the Screen Recording section

**Keyboard shortcuts not working**:
- Verify permissions are granted (use `AiPasteHelper permissions`)
- Check if another app is using Cmd+Shift+V
- Try restarting the shortcuts daemon: Stop and restart the app

### Electron/Node Issues

**Convex connection issues**: 
- Check if Convex backend is running: Look for "Convex backend started" in logs
- Verify ports 52100-52101 are available
- Backend auto-restarts on crash (max 3 retries)
- Database stored at `~/Library/Application Support/@aipaste/electron/aipaste-convex-db/`

**Port conflicts**: If you encounter port conflicts, check that these ports are available:
- 3000 (Next.js)
- 52100 (Convex backend)
- 52101 (Convex actions)

**Environment variables**: Double-check that your `.env` file is properly configured with the required variables.

**Dependencies**: If you encounter dependency issues, try deleting `node_modules` and `pnpm-lock.yaml`, then run `pnpm install` again.

## 🏗️ Architecture & Development

### Application Architecture
```
┌─────────────────┐    JSON/IPC    ┌──────────────────┐
│   Electron UI   │ ◄─────────────► │   Swift CLI      │
│  (TypeScript)   │                │  (AiPasteHelper) │
├─────────────────┤                ├──────────────────┤
│ • Settings UI   │                │ • Clipboard Mon. │
│ • Dashboard     │                │ • Table Format   │
│ • History View  │                │ • Shortcuts      │
│ • Permissions   │                │ • Permissions    │
└─────────────────┘                └──────────────────┘
         │                                   │
         │                                   │
         ▼                                   ▼
┌─────────────────┐                ┌──────────────────┐
│   Next.js App   │                │  macOS System    │
│   (Frontend)    │                │   Integration    │
└─────────────────┘                └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Convex Backend │
│  (Local SQLite) │
│  Port: 52100    │
└─────────────────┘
```

### Development Workflow
1. **Swift CLI Development**: Make changes in `swift-cli/Sources/AiPasteHelper/`
2. **Build Swift**: Run `pnpm build:swift`
3. **Test CLI**: Use `./.build/release/AiPasteHelper test`
4. **Electron Development**: Make changes in `src/main/` and `src/app/`
5. **Integration Testing**: Run `pnpm run dev` to test full integration

### Communication Flow
1. **User Action** (copy table, press shortcut)
2. **Swift CLI Detection** (clipboard monitoring, event tap)
3. **Processing** (table parsing, formatting)
4. **JSON Response** (structured data back to Electron)
5. **UI Update** (real-time status, history updates)

### File Organization
- **Swift CLI**: All native macOS functionality
- **Electron Main**: Process management, IPC handlers, Swift bridge
- **Next.js Frontend**: User interface, settings, dashboard
- **Agent Docs**: Development progress tracking and reports

### Getting Help

For additional support or questions about this template, please contact the development team.# convex-s3
