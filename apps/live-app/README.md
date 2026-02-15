# Live App

A standalone Electron application for AI-powered file processing and conversation. Uses Google Gemini for multimodal analysis of images, PDFs, audio, video, and web content. Includes cloud storage integration with S3 and Cloudflare R2.

## Tech Stack

- **Electron** 37.2 with Electron Forge
- **React** 19 with TypeScript
- **Vite** 5.1 (via Electron Forge plugin)
- **Tailwind CSS** 4.1
- **Google Gemini AI** (`@google/generative-ai`)
- **AWS SDK** (S3 client for local storage and R2)
- **Pipecat AI** (voice/multimodal interaction)
- **WebSocket** (Chrome extension communication)

## Features

### Global Hotkeys
| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+X` | Capture selected files from Finder |
| `Cmd+Shift+N` | Toggle window visibility |
| `Cmd+Shift+A` | Toggle audio recording |
| `Cmd+Shift+S` | Toggle screen recording |
| `Cmd+Shift+M` | Turn off all media |

### File Processing
Analyzes files using Google Gemini AI:
- **Images** — Description and content analysis
- **PDFs** — Text extraction and summarization
- **Audio** — Transcription with timestamps
- **Video** — Frame extraction and analysis
- **Text** — Content analysis
- **YouTube** — Metadata, title, and transcript extraction
- **Webpages** — Content extraction and summarization

### Media Recording
- Audio capture with timestamp synchronization
- Screen recording with frame capture
- Timeline-intelligent audio/video stitching

### S3 Cloud Storage
- Local S3 server on port 9000 for development
- Cloudflare R2 for production cloud storage
- Presigned URLs for secure file transfers
- File metadata tracking via Convex

### Chrome Extension Integration
- WebSocket server on `localhost:30010`
- Receives browser tab data (URLs, page content)
- Processes YouTube videos and webpages

## Structure

```
src/
├── index.ts                  # Electron main process
├── app.tsx                   # React root component
├── preload.ts                # Secure IPC bridge
├── renderer.ts               # Renderer entry point
├── components/
│   ├── ChatContiner.tsx      # Main chat interface
│   ├── MessageList.tsx       # Message rendering
│   ├── Message.tsx           # Message component
│   ├── pipecat-comp/         # Voice AI integration
│   └── shadcn/               # UI components
├── file-processing/
│   ├── index.ts              # FileProcessingService
│   ├── core/
│   │   ├── gemini-client.ts  # Google AI integration
│   │   ├── status-manager.ts # Processing state tracking
│   │   └── file-utils.ts     # File system operations
│   └── processors/
│       ├── image-processor.ts
│       ├── pdf-processor.ts
│       ├── audio-video-processor.ts
│       ├── text-processor.ts
│       ├── youtube-processor.ts
│       └── webpage-processor.ts
├── s3-service/
│   ├── S3ServiceManager.ts   # Core S3 operations
│   ├── LocalS3Server.ts      # Express dev server
│   ├── R2Service.ts          # Cloudflare R2 integration
│   ├── S3Types.ts            # Type definitions
│   └── S3Utils.ts            # Utilities
└── types/
    └── electron-api.ts       # Electron API types
```

## Prerequisites

- Node.js 18+
- Google Gemini API key

## Setup

Create a `.env` file in this directory:

```env
GOOGLE_API_KEY=your_gemini_api_key

# Optional — for S3/R2 cloud storage
CONVEX_URL=https://your-convex-deployment.convex.cloud
CONVEX_ADMIN_KEY=your_admin_key
```

## Development

```bash
npm start
```

This starts the Electron app with Vite hot reload.

## Build

```bash
npm run package    # Package for current platform
npm run make       # Create distributables (DMG, ZIP, DEB, RPM)
```

## Data Storage

Processed file content is stored in `~/.neutralbase/`. Each file gets a unique directory based on its MD5 hash, containing the analysis output and a status JSON file.
