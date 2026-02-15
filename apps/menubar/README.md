# Menubar

A lightweight popup window attached to the system tray icon. Built with Vite and React 19, it provides quick-access actions without opening the full dashboard.

## Tech Stack

- **Vite** 7.1 with SWC
- **React** 19
- **TypeScript** 5.8
- **Tailwind CSS** 4.1
- **@paster/ui** shared component library

## Features

Two action buttons:
- **Dashboard** — Opens the main application window
- **Quit Paster** — Exits the application

## Structure

```
src/
├── App.tsx           # Main component with action buttons
├── main.tsx          # React entry point
├── index.css         # Tailwind imports
├── electron.d.ts     # IPC type definitions
└── vite-env.d.ts     # Vite types
```

## IPC Communication

| Channel | Purpose |
|---------|---------|
| `menubar:show-main-window` | Opens dashboard, hides menubar |
| `menubar:quit-app` | Terminates the application |

## Window Behavior

- **Size**: 200 x 90px
- **Frameless**: No title bar or window chrome
- **Always on top**: Stays above other windows
- **Auto-hide**: Closes when clicking outside
- **Platform-specific**: macOS vibrancy effect, Windows transparent background

## Development

```bash
# From monorepo root (runs alongside Electron and main-window)
pnpm dev

# Standalone
cd apps/menubar && pnpm dev
```

Runs on `http://localhost:5173` in development. The Electron menubar window loads this URL directly.

## Build

```bash
pnpm build   # Vite production build
```

Built output is loaded from `app/menubar/dist/index.html` in production.
