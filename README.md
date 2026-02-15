# Paster

A macOS desktop application for intelligent clipboard management with AI-powered file processing, table formatting, and cloud storage. Built as a monorepo with Electron, Next.js, React, and a native Swift CLI.

## Architecture

```
paster/
├── electron/              # Electron main process — app orchestrator
├── apps/
│   ├── main-window/       # Next.js 15 dashboard (React 19)
│   ├── menubar/           # Vite + React menubar popup
│   ├── live-app/          # Standalone Electron app — AI file processor
│   └── s3-manager/        # Standalone Electron app — S3/R2 file manager
├── packages/
│   └── ui/                # Shared UI components (shadcn/ui + Tailwind)
├── native/
│   └── swift-cli/         # macOS native helper (clipboard, Finder, shortcuts)
├── convex/                # Backend functions (self-hosted Convex)
├── scripts/               # Build and setup scripts
└── docs/
    └── planning/          # Feature planning documents
```

### How it fits together

**Paster** (the main app) is a tray-first Electron application. The `electron/` directory runs the main process, which creates two windows:

- **Main Window** (`apps/main-window/`) — The full dashboard UI, built with Next.js 15. Handles settings, clipboard history, file conversion, and onboarding.
- **Menubar** (`apps/menubar/`) — A small popup attached to the system tray icon. Two buttons: open the dashboard or quit.

Both communicate with the Electron main process via IPC through secure preload scripts with `contextIsolation`.

The **Swift CLI** (`native/swift-cli/`) provides native macOS integration — clipboard monitoring, keyboard shortcut handling, Finder file selection, and table formatting. Electron spawns it as child processes.

**Convex** (`convex/`) is the real-time backend, self-hosted locally. It stores clipboard history, file conversion records, and S3 object metadata.

Two standalone apps live alongside the main app:

- **Live App** (`apps/live-app/`) — An AI-powered file processor using Google Gemini. Handles images, PDFs, audio, video, and webpages.
- **S3 Manager** (`apps/s3-manager/`) — A file management interface for local S3 storage and Cloudflare R2 cloud storage.

## Prerequisites

- **macOS** (primary target)
- **Node.js** >= 20
- **pnpm** 9.15+
- **Swift** 5.9+ (for the native CLI)
- **Convex** backend binary (auto-downloaded on install)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the Convex backend (in a separate terminal)
pnpm convex:dev

# Start the main app (Electron + Next.js + Menubar)
pnpm dev
```

This runs three processes concurrently:
- Electron main process (with hot reload via nodemon)
- Next.js dev server on `localhost:3000` (main window)
- Vite dev server on `localhost:5173` (menubar)

### Running standalone apps

```bash
# S3 Manager (requires local S3 service running)
pnpm s3-manager

# Live App (requires Google Gemini API key in apps/live-app/.env)
cd apps/live-app && npm start
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the full app in development mode |
| `pnpm build` | Build all apps for production |
| `pnpm dist` | Package the Electron app for distribution |
| `pnpm dist:prod` | Production distribution build |
| `pnpm build:swift` | Compile the Swift CLI |
| `pnpm convex:dev` | Start the local Convex backend |
| `pnpm convex:deploy` | Deploy Convex functions |
| `pnpm s3-manager` | Launch the S3 Manager app |
| `pnpm typecheck` | Run TypeScript checks across all packages |
| `pnpm lint` | Lint all packages |
| `pnpm clean` | Clean build artifacts |
| `pnpm clean:all` | Deep clean (removes node_modules and lockfile) |
| `pnpm fresh` | Full reset (clean + reinstall) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Electron |
| Main UI | Next.js 15, React 19 |
| Menubar UI | Vite, React 19 |
| Shared Components | shadcn/ui, Tailwind CSS |
| Backend | Convex (self-hosted) |
| Native Integration | Swift (macOS CLI) |
| AI Processing | Google Gemini |
| Cloud Storage | Cloudflare R2, local S3 |
| Build | tsup, electron-builder, Electron Forge |
| Package Manager | pnpm workspaces |

## Project Structure Details

Each app and module has its own README with detailed documentation:

- [`electron/README.md`](electron/README.md) — Main process, window management, IPC handlers
- [`apps/main-window/README.md`](apps/main-window/README.md) — Dashboard UI, settings, clipboard history
- [`apps/menubar/README.md`](apps/menubar/README.md) — Tray popup interface
- [`apps/live-app/README.md`](apps/live-app/README.md) — AI file processing app
- [`apps/s3-manager/README.md`](apps/s3-manager/README.md) — S3/R2 storage manager

## Environment Variables

Create `.env.local` at the project root for Convex:

```env
CONVEX_ADMIN_KEY=your_convex_admin_key
```

Individual apps may require their own `.env` files — see their respective READMEs.
