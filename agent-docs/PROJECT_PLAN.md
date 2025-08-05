# AiPaste Electron Port - Project Plan

## Overview
Port core features from AiPaste (Swift) and TRex OCR to a cross-platform Electron app.

## Core Features to Implement

### 1. Clipboard Watcher & Formatter
- **Watch**: Detect when user copies spreadsheet data (Cmd+C)
- **Format**: Auto-reformat with `|` delimiters
- **Paste**: Custom paste with Cmd+Shift+V

### 2. Screenshot OCR
- **Trigger**: Global keyboard shortcut
- **Select**: Click & drag to select screen area
- **OCR**: Extract text from selection
- **Output**: Place text in clipboard

## Technical Approach

### Source Repositories
- **AiPaste**: `/Users/moinulmoin/Developer/clients/neutralbase/aipaste` (clipboard logic)
- **TRex**: `/Users/moinulmoin/Developer/clients/neutralbase/angry-ants` (OCR functionality)

### Architecture
1. Extract minimal Swift code from both apps
2. Create Node.js native modules to bridge Swift → Electron
3. Use existing Electron template, strip unnecessary features
4. Implement simple UI with shadcn

## Development Priority

### Phase 1: Clipboard Basics
1. Set up minimal Electron app (remove auth, DB, etc.)
2. Port clipboard watching from AiPaste
3. Hardcode keyboard shortcuts initially

### Phase 2: Formatting
1. Implement spreadsheet detection
2. Add `|` delimiter formatting
3. Custom paste functionality

### Phase 3: OCR Integration
1. Extract TRex OCR code
2. Screenshot selection UI
3. OCR processing

### Phase 4: UI & Polish
1. Onboarding flow (like AiPaste but new design)
2. Settings window (no menu bar)
3. Window sizing (like voicetypr)
4. Auto-start on login

## Key Requirements
- **Always run in background**
- **No menu bar dropdown** - just settings window
- **macOS permissions**: Accessibility & Screen Recording
- **Use shadcn components** for UI
- **Extract keyboard listener** as standalone Swift file

## What to Skip (From Template)
- Database features
- Authentication
- Licensing system
- Usage tracking
- Menu bar implementation

## Next Steps
1. Analyze AiPaste Swift code for clipboard logic
2. Analyze TRex Swift code for OCR functionality
3. Design Swift-to-Electron bridge
4. Start with clipboard watcher implementation