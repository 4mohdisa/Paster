# Kash Integration Documentation

## Overview
Kash (Knowledge Agent Shell) is an AI-native command-line framework that transforms Python functions into composable "actions". We're using Kash in AiPaste for its powerful file processing capabilities, particularly its FileStore for persistence, caching, and deduplication. Users can select files in Finder and press Cmd+Shift+K to convert them to Markdown.

## Architecture

### Flow
1. User selects file(s) in Finder
2. Presses Cmd+Shift+K
3. Swift CLI captures shortcut and gets Finder selection
4. Electron spawns Python process with Kash
5. Kash converts file (with caching/deduplication)
6. Backend saves to Convex database
7. UI auto-updates via Convex subscription

### Key Components

#### Python Script (`electron/resources/kash-ultimate-runner.py`)
- Uses Kash FileStore for persistence and caching
- Converts DOCX/HTML/PDF to Markdown
- Returns clean JSON output
- Workspace location: `~/.aipaste/kash-workspace/`

#### Python Bridge (`electron/main/python-bridge.ts`)
- Manages standalone Python environment in `kash-env/`
- Spawns Python process with proper stdio separation
- Parses JSON response

#### Process Manager (`electron/main/process-manager.ts`)
- Listens for Cmd+Shift+K shortcut
- Orchestrates conversion flow
- Saves to Convex using ConvexHttpClient

#### Convex Integration
- Table: `conversionHistory` stores conversion metadata
- Backend saves directly (more reliable than frontend)
- Frontend auto-updates via subscription

## Setup

### Build Python Environment
```bash
pnpm build:kash
```
This creates `electron/resources/kash-env/` with Python 3.11 and dependencies.

### Development
```bash
pnpm dev        # Start development server
pnpm dev:fresh  # Clean build and start
```

## Testing

### Manual Test
1. Select a DOCX/HTML file in Finder
2. Press Cmd+Shift+K
3. Check for `.md` file next to original
4. Navigate to Files tab to see history

### Verify in Logs
```
[app] Cmd+Shift+K detected - triggering Kash conversion
[app] Processing 1 files with Kash action 'markdownify'
[app] File conversion succeeded
[app] ✅ Conversion history saved to Convex from backend
```

## Benefits

- **Caching**: Repeated conversions are instant
- **Deduplication**: Same content never stored twice
- **Persistence**: Workspace survives app restarts
- **Reliability**: Backend saves directly to database
- **Clean Output**: No logging pollution in JSON

## Troubleshooting

### "Importing resource:" Error
- **Cause**: Kash's log.message() outputs to stdout
- **Solution**: Use `record_console()` context manager and `rich_logging=True`

### Python Not Found
- **Cause**: kash-env not built
- **Solution**: Run `pnpm build:kash`

### Convex Save Fails
- **Cause**: Extra fields in mutation
- **Solution**: Don't pass `timestamp` - Convex adds it automatically

## File Locations

- **Converted Files**: Next to original (e.g., `test.docx` → `test.md`)
- **Kash Workspace**: `~/.aipaste/kash-workspace/`
  - `resources/` - Original imported files
  - `docs/` - Converted documents
  - `.kash/` - Cache and metadata