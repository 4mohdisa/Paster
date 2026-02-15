# Main Window

The primary dashboard UI for Paster. Built with Next.js 15 and React 19, it runs inside the Electron main window and provides settings management, clipboard history, file conversion, and an onboarding wizard.

## Tech Stack

- **Next.js** 15.3 with Turbopack
- **React** 19
- **Tailwind CSS** via `@paster/ui`
- **Convex** for real-time data (clipboard history, conversion records)
- **next-themes** for light/dark mode
- **lucide-react** for icons

## Features

### Onboarding
Multi-step setup wizard that walks users through:
- macOS accessibility permission request
- Daemon startup (keyboard shortcut monitoring)
- Kash framework installation (document conversion)
- System verification

### Dashboard
- **General Settings** — Configure table formatting output (Simple, Markdown, Pretty-printed, HTML)
- **Keyboard Shortcut** — Displays the active shortcut (Cmd+Shift+V)
- **Prefix Text** — Add explanatory text before formatted tables
- **System Status** — Real-time permission and daemon status
- **Clipboard History** — View, copy, and manage clipboard items stored in Convex
- **File Conversion** — Convert documents (DOCX, HTML, PDF) to Markdown via Kash

## Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout with providers
│   └── page.tsx                   # Routes between onboarding and dashboard
├── components/
│   ├── dashboard.tsx              # Main dashboard interface
│   ├── onboarding.tsx             # Setup wizard
│   ├── history-panel.tsx          # Clipboard history display
│   ├── file-conversion-panel.tsx  # Document conversion UI
│   ├── navigation-sidebar.tsx     # Sidebar navigation
│   └── providers/
│       └── theme-provider.tsx     # Dark/light theme
├── providers/
│   └── convex-provider.tsx        # Convex backend connection
└── hooks/
    └── use-clipboard-history.ts   # Clipboard history hook
```

## IPC Communication

Communicates with the Electron main process via `window.electron`:

| Channel | Purpose |
|---------|---------|
| `settings:get-onboarding-status` | Check if onboarding is complete |
| `settings:set-onboarding-complete` | Mark onboarding done |
| `swift:get-settings` | Get table formatting settings |
| `swift:update-settings` | Update formatting preferences |
| `process:check-permissions` | Check macOS accessibility permissions |
| `process:start-shortcuts` | Start keyboard monitoring daemon |
| `kash:process-files` | Convert selected files |
| `kash:get-finder-selection` | Get selected Finder files |

## Development

```bash
# From monorepo root (runs alongside Electron and menubar)
pnpm dev

# Standalone
cd apps/main-window && pnpm dev
```

Runs on `http://localhost:3000` in development. The Electron main process loads this URL directly.

## Build

```bash
pnpm build   # Next.js standalone output
```

In production, the Electron main process starts a local Next.js server from the built standalone output.
