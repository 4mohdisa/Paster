# AiPaste - Project Overview

**Last Updated**: 2025-01-26  
**Version**: 1.0.0  
**Status**: Production Ready (98% Complete)

## What is AiPaste?

AiPaste is a **universal intelligent paste application** for macOS that transforms any clipboard content into clean, readable, and beautifully formatted text. Whether you're pasting spreadsheets, converting documents, or cleaning up messy text, AiPaste makes your paste perfect every time.

### Core Features
- 🎯 **Universal Smart Paste** - Intelligently formats any content type
- 📊 **Spreadsheet Magic** - Excel/Google Sheets → Beautiful tables
- 📄 **File Conversion (Kash)** - DOCX/PDF → Clean markdown instantly
- ⚡ **Global Shortcuts** - Cmd+Shift+V for paste, Cmd+Shift+K for Kash
- 🔄 **Multiple Output Formats** - Markdown, HTML, plain text, pretty tables
- 📝 **Clipboard History** - Never lose important clips again
- 🎨 **Real-time Dashboard** - Beautiful UI with instant updates
- 🚀 **Finder Integration** - Select files → Convert with one shortcut

## How It Works

### Intelligent Paste Flow (Cmd+Shift+V)
```mermaid
graph LR
    A[Copy any content] --> B[Press Cmd+Shift+V]
    B --> C[AI detects type]
    C --> D[Apply smart formatting]
    D --> E[Clean paste delivered]
```

### Document Conversion Flow (Cmd+Shift+K) 
```mermaid
graph LR
    A[Select files in Finder] --> B[Press Cmd+Shift+K]
    B --> C[Kash processes documents]
    C --> D[Extract clean text/markdown]
    D --> E[Ready to paste anywhere]
```

### The Magic Behind It
1. **Copy anything** - Spreadsheets, documents, code, messy text
2. **Hit the shortcut** - Cmd+Shift+V for paste, Cmd+Shift+K for files
3. **AI processes** - Detects content type and applies best formatting
4. **Clean output** - Perfect markdown, tables, or plain text
5. **Instant paste** - Formatted content appears where you need it

## What Can AiPaste Handle?

### 📊 Spreadsheet Data
- **Excel/Google Sheets** → Clean pipe-delimited tables
- **CSV data** → Formatted markdown tables
- **HTML tables** → Plain text or markdown

### 📄 Documents (via Kash)
- **Word docs (.docx)** → Clean markdown with structure
- **PDFs** → Extracted text with formatting preserved
- **Rich text** → Simplified, readable plain text

### 🔮 Future Content Types (Roadmap)
- **Code snippets** → Syntax-aware formatting
- **Screenshots** → OCR text extraction
- **JSON/XML** → Pretty-printed structures
- **Messy text** → Smart paragraph cleaning

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Desktop Framework** | Electron 36 | Cross-platform desktop app |
| **UI Framework** | Next.js 15 + React 19 | Modern web UI |
| **Native Layer** | Swift 5.x CLI | macOS clipboard & keyboard |
| **Database** | Convex (local SQLite) | Real-time data sync |
| **Package Manager** | pnpm workspaces | Monorepo management |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS 4 | Utility-first styling |

## Project Structure

```
electron-aipaste/
├── apps/
│   └── main-window/          # Next.js UI application
│       ├── src/
│       │   ├── app/         # App router pages
│       │   ├── components/  # React components
│       │   └── hooks/       # Custom React hooks
│       └── package.json
│
├── electron/                 # Electron backend
│   ├── main/
│   │   ├── index.ts        # Main process entry
│   │   ├── swift-bridge.ts # Swift CLI communication
│   │   ├── process-manager.ts # Daemon management
│   │   ├── convex-client.ts  # Database client
│   │   └── ipc-handlers/   # IPC communication
│   └── preload/            # Preload scripts
│
├── native/
│   └── swift-cli/          # Swift CLI tool
│       └── Sources/AiPasteHelper/
│           ├── main.swift           # CLI entry point
│           ├── TableFormatter.swift # Format logic
│           ├── SettingsCommand.swift # Settings management
│           ├── ShortcutsCommand.swift # EventTap monitor
│           └── FinderSelectionCommand.swift # File monitoring
│
├── convex/                 # Backend functions
│   ├── clipboardHistory.ts # History management
│   ├── conversionHistory.ts # Kash conversions
│   └── settings.ts         # User preferences
│
└── packages/              # Shared packages
    ├── ui/               # Component library
    └── config-typescript/ # TS configurations
```

## Key Components Explained

### Swift CLI (`native/swift-cli/`)
The brain of clipboard operations. Handles:
- **EventTap monitoring** - Intercepts keyboard shortcuts globally
- **Clipboard access** - Reads/writes system clipboard
- **Table formatting** - Converts between formats
- **Settings persistence** - JSON config in `~/.aipaste/`

### Electron Backend (`electron/`)
Bridge between native and UI. Manages:
- **Process lifecycle** - Spawns/monitors Swift CLI
- **IPC handlers** - Routes messages between processes
- **Convex client** - Database operations
- **Permission requests** - Accessibility & screen recording

### Next.js UI (`apps/main-window/`)
User interface. Provides:
- **Dashboard** - Real-time status and controls
- **Settings page** - Configure formatting options
- **History panel** - Browse clipboard history
- **Onboarding** - First-run permission setup

### Convex Backend (`convex/`)
Real-time database. Stores:
- **Clipboard history** - Past entries with formatting
- **User settings** - Preferences sync
- **Conversion history** - Kash document processing

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development (all services)
pnpm dev

# Build Swift CLI
cd native/swift-cli && swift build

# Test Swift CLI
cd native/swift-cli/tests
./test-cli.sh           # Basic functionality
./test-paste-formats.sh # Format types
./test-shortcuts.sh     # Keyboard monitoring

# Build for production
pnpm build
pnpm dist

# Type checking
pnpm typecheck
```

## How Components Communicate

### IPC Flow
```
UI (React) <--> Electron Main <--> Swift CLI
     ↓              ↓                  ↓
  Convex DB    IPC Handlers      JSON Protocol
```

### Event Flow Example
1. UI requests settings → IPC handler → Swift CLI `settings get`
2. Swift returns JSON → IPC handler → UI updates
3. Clipboard changes → Swift emits event → Electron → UI updates
4. User clicks history item → Convex subscription → Real-time sync

## Configuration

### User Settings (`~/.aipaste/settings.json`)
```json
{
  "outputFormat": "markdown",
  "usePrefixEnabled": true,
  "userDefinedPrefix": "Table data:",
  "shortcutModifiers": 3,
  "shortcutKeyCode": 9
}
```

### Environment Variables
- `CONVEX_URL` - Local database URL (auto-configured)
- `NODE_ENV` - Development/production mode

## Permissions Required

| Permission | Purpose | Requested |
|------------|---------|-----------|
| **Accessibility** | Keyboard monitoring for shortcuts | On first launch |
| **Screen Recording** | Future OCR feature | When OCR added |

## Current Status

### ✅ Completed (98%)
- Core formatting engine
- Keyboard shortcut monitoring
- Clipboard history with Convex
- Settings management
- Beautiful UI with onboarding
- Process management with health checks
- Kash document conversion
- All 4 output formats
- Real-time sync

### 🚧 Remaining (2%)
- OCR implementation from TRex
- Launch at login option

## Architecture Decisions

1. **Why Swift CLI over native modules?**
   - Easier debugging and testing
   - Process isolation (crashes don't affect Electron)
   - Direct port of original Swift code
   - No complex C++ bindings

2. **Why Convex for database?**
   - Real-time subscriptions out of the box
   - Local SQLite for privacy
   - Type-safe TypeScript API
   - No backend infrastructure needed

3. **Why monorepo with pnpm?**
   - Shared dependencies
   - Atomic commits across packages
   - Better code organization
   - Efficient disk usage

## Testing Strategy

### Swift CLI Tests
- Unit tests for formatter logic
- Integration tests for commands
- Shell scripts for end-to-end testing
- 26 automated tests covering all features

### TypeScript/Electron
- Type checking with TypeScript
- Manual testing of IPC flows
- UI component testing (planned)

## Performance Characteristics

- **Clipboard monitoring**: <0.1% CPU usage
- **Format operation**: <20ms for 100 rows
- **Memory usage**: ~50MB total
- **Startup time**: <2 seconds
- **Database sync**: <100ms latency

## Security Considerations

- **No network requests** except local Convex
- **Settings stored locally** in user home
- **No data collection** or analytics
- **Permissions requested** only when needed
- **Open source** for transparency

## Future Enhancements

1. **OCR Support** - Extract text from screenshots (main remaining feature)
2. **Smart Text Cleaning** - Remove formatting artifacts automatically
3. **More File Types** - Expand beyond DOCX/PDF
4. **Cross-platform** - Windows/Linux support eventually

## Contributing

1. Fork the repository
2. Create feature branch
3. Follow existing code patterns
4. Add tests for new features
5. Update documentation
6. Submit pull request

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: Report bugs or request features
- Documentation: This file and agent-docs/
- Source Code: Fully commented for clarity

---

*AiPaste - Making spreadsheet data beautiful, one paste at a time.*