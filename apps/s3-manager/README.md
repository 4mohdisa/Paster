# S3 Manager

Standalone Electron app for managing files in local S3 storage and Cloudflare R2 cloud storage.

## Features

- **File Upload** — Drag-and-drop or click to upload files
- **Smart Storage** — Files >5MB go to cloud (R2), smaller files stay local
- **File Management** — View, download, and delete files
- **Cloud Migration** — Migrate local files to cloud storage
- **Test File Generation** — Generate 5MB test files for integration testing
- **System Logs** — Built-in log viewer (triple-click logo or Cmd+L)

## Prerequisites

- Local S3 service running on `localhost:9000` (from `apps/live-app`)
- Convex backend running

## Usage

```bash
# From monorepo root
pnpm s3-manager

# Or from this directory
npx electron .
```

## Architecture

```
src/
├── main.js          # Electron main process + IPC handlers
├── preload.js       # Secure IPC bridge (contextBridge)
└── renderer/
    ├── index.html   # Application UI
    ├── styles.css   # Styles
    └── app.js       # Renderer logic
```
