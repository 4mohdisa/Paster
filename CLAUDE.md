# Claude Code Project Configuration - AiPaste Electron

## Project Overview
Building an Electron application with Swift CLI for native macOS features (clipboard management and OCR).

## Current Status
- **Phase**: 2 (Core Features)
- **Completion**: 35%
- **Active Task**: OCR Implementation
- **Last Updated**: Current Session

## Automatic Behaviors

### Before Starting Work
1. Read `agent-docs/MASTER_PROGRESS_REPORT.md`
2. Check latest implementation report
3. Verify Swift CLI builds
4. Identify next task from progress report

### After Completing Work
1. Update MASTER_PROGRESS_REPORT.md
2. Create implementation report
3. Run verification tests
4. Update todo list

## Key Files to Track
- `agent-docs/MASTER_PROGRESS_REPORT.md` - Overall progress
- `agent-docs/WORK_HOOKS_PROTOCOL.md` - Work procedures
- `swift-cli/Sources/AiPasteHelper/` - Swift implementation
- `src/main/swift-bridge.ts` - TypeScript bridge

## Testing Commands
```bash
# Quick Swift CLI test
./.build/debug/AiPasteHelper test

# Format test
echo -e "Name\tAge\nJohn\t30" | ./.build/debug/AiPasteHelper format --stdin

# Monitor test (long-running)
./.build/debug/AiPasteHelper monitor
```

## Architecture Reminders
- Swift CLI handles all native macOS functionality
- TypeScript bridge manages process communication
- JSON IPC protocol for type-safe communication
- Original code logic must be preserved exactly

## Next Priority Tasks
1. **OCR Implementation** - Extract from TRex/AiPasteCore.swift
2. **EventTap Integration** - Keyboard shortcuts
3. **Permissions API** - Accessibility and screen recording

## Development Principles
- Port exact logic from original Swift code
- Test each component independently
- Document all implementations
- Update progress after each component
- Maintain backward compatibility

## Common Issues & Solutions
- **Swift build fails**: Check Package.swift syntax
- **JSON parse error**: Ensure all CLI output is valid JSON
- **Process not found**: Verify binary path in TypeScript bridge

## Important Context
This project ports features from two Swift apps:
1. **AiPaste** (`/Users/moinulmoin/Developer/clients/neutralbase/aipaste`) - Clipboard formatting
2. **TRex** (`/Users/moinulmoin/Developer/clients/neutralbase/angry-ants`) - OCR functionality

The goal is minimal Swift code for native features, with everything else in Electron/TypeScript.