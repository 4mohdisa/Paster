# Electron Main Process

The orchestrator for the Paster desktop application. Manages window lifecycle, system tray, native Swift integration, Convex backend, and IPC communication between the main process and renderer windows.

## What It Does

- Creates and manages the **main window** (Next.js dashboard) and **menubar popup** (Vite React)
- Runs a **system tray** icon with context menu
- Spawns and monitors the **Swift CLI** for clipboard watching, keyboard shortcuts, and Finder integration
- Starts the **Convex backend** as a child process
- Bridges all native OS capabilities to renderer processes through secure IPC

## Tech Stack

- **Electron** 37.2
- **tsup** for TypeScript compilation
- **electron-builder** for packaging and distribution
- **nodemon** for development hot reload
- **electron-log** for structured logging

## Structure

```
main/
├── index.ts               # App entry point and lifecycle
├── main-window.ts         # Dashboard window (900x850)
├── menubar-window.ts      # Tray popup (200x90)
├── tray-manager.ts        # System tray icon and menu
├── process-manager.ts     # Child process orchestration
├── swift-bridge.ts        # Swift CLI binary wrapper
├── python-bridge.ts       # Python/Kash process bridge
├── convex-client.ts       # Convex HTTP client (singleton)
├── settings-manager.ts    # Persistent app settings
├── history-manager.ts     # Legacy clipboard history
├── logger.ts              # electron-log wrapper
├── config/
│   └── paths.ts           # Centralized path management
├── ipc-handlers/
│   ├── index.ts           # Handler registration
│   ├── swift.ts           # swift:* channels
│   ├── process-manager.ts # process:* channels
│   ├── convex.ts          # convex:* channels
│   ├── kash.ts            # kash:* channels
│   ├── kash-installer.ts  # Lazy Kash installation
│   ├── settings.ts        # Settings persistence
│   └── menubar.ts         # Menubar window control
└── utils/
    └── types.ts           # Shared TypeScript types

preload/
└── index.ts               # contextBridge API (window.electron)

resources/
├── bin/                   # Convex backend binary (auto-downloaded)
├── icon.png               # App icon
├── trayTemplate.png       # macOS tray icon
├── trayTemplate@2x.png    # macOS retina tray icon
├── tray-icon.png          # Windows/Linux tray icon
└── kash_wrapper.py        # Kash integration scripts
```

## Window Management

### Main Window
- Loads Next.js from `http://localhost:3000` (dev) or starts a local server on a dynamic port (prod)
- Tray-first UX: hidden on startup, shown via tray menu or hotkey
- Secure preload script with context isolation

### Menubar Window
- 200x90 frameless popup positioned below the tray icon
- macOS vibrancy effect / Windows transparent background
- Auto-hides on blur

## IPC Channels

The preload script exposes `window.electron` with these capabilities:

| Category | Channels |
|----------|----------|
| Swift CLI | `swift:format-table`, `swift:execute-paste`, `swift:get-settings`, `swift:update-settings` |
| Process | `process:check-status`, `process:check-permissions`, `process:start-shortcuts`, `process:shortcuts-status` |
| Convex | `convex:get-info` |
| Kash | `kash:process-files`, `kash:get-finder-selection`, `kash:check-dependencies`, `kash:install` |
| Settings | `settings:get-onboarding-status`, `settings:set-onboarding-complete`, `settings:reset-onboarding` |
| Menubar | `menubar:show-main-window`, `menubar:quit-app` |

## Process Management

The `ProcessManager` handles child processes:

| Process | Purpose |
|---------|---------|
| **Clipboard Monitor** | Swift CLI watching the system clipboard |
| **Shortcuts Daemon** | Swift CLI listening for global keyboard shortcuts |
| **Convex Backend** | Self-hosted Convex server on port 52100 |

All processes have heartbeat monitoring and automatic restart logic. Graceful shutdown is coordinated on app quit (SIGINT/SIGTERM).

## Development

```bash
# From monorepo root (recommended)
pnpm dev

# Build only
cd electron && pnpm build
```

In development, `tsup --watch` recompiles on changes and `nodemon` restarts the Electron process.

## Build and Distribution

```bash
# Test packaging (local directory output)
pnpm dist

# Production build
pnpm dist:prod
```

Uses `electron-builder` with platform-specific configuration:
- **macOS**: Hardened runtime with entitlements
- **Linux**: AppImage, snap, deb
- **Windows**: NSIS installer

The build bundles:
- Compiled main/preload JS from `build/`
- Next.js standalone output from `apps/main-window/`
- Menubar built HTML from `apps/menubar/`
- Swift CLI binary from `native/swift-cli/`
- Convex backend binary from `resources/bin/`
