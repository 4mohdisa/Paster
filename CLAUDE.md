# Claude Code Project Configuration - AiPaste Monorepo

## Project Overview
Building an Electron application with Swift CLI for native macOS features (clipboard management and OCR) using a monorepo architecture with pnpm workspaces.

## Current Status
- **Phase**: 2 (Core Features)
- **Completion**: 35%
- **Active Task**: OCR Implementation
- **Last Updated**: 2025-08-16

## Monorepo Structure
```
aipaste-monorepo/
├── apps/
│   ├── main-window/        # Next.js UI (@aipaste/main-window)
│   └── menubar/           # Future menubar app
├── electron/              # Electron backend (@aipaste/electron)
├── native/               # Native modules
│   └── swift-cli/        # Swift CLI (@aipaste/swift-cli)
├── packages/             # Shared packages
│   ├── ui/              # UI components (@aipaste/ui)
│   └── config-typescript/ # TS configs
└── agent-docs/          # Documentation
```

## Automatic Behaviors

### Before Starting Work
1. Read `agent-docs/CURRENT_ARCHITECTURE_2025.md` for current state
2. Read `agent-docs/MASTER_PROGRESS_REPORT.md` for progress
3. Verify Swift CLI builds: `cd native/swift-cli && swift build`
4. Check electron builds: `pnpm --filter @aipaste/electron build`
5. Identify next task from progress report

### After Completing Work
1. Update MASTER_PROGRESS_REPORT.md
2. Create/update implementation report
3. Run verification tests
4. Update todo list
5. Ensure all packages build: `pnpm build`

## Key Files to Track
- `agent-docs/CURRENT_ARCHITECTURE_2025.md` - Architecture reference
- `agent-docs/MASTER_PROGRESS_REPORT.md` - Overall progress
- `agent-docs/WORK_HOOKS_PROTOCOL.md` - Work procedures
- `native/swift-cli/Sources/AiPasteHelper/` - Swift implementation
- `electron/main/swift-bridge.ts` - TypeScript bridge
- `electron/main/process-manager.ts` - Process management
- `electron/main/config/paths.ts` - Path configuration

## Testing Commands

### Swift CLI Tests
```bash
# Build Swift CLI
cd native/swift-cli
swift build -c release

# Quick test
./.build/release/AiPasteHelper test

# Run automated test scripts (from tests directory)
cd tests
./test-cli.sh              # Basic CLI functionality tests (26 tests)
./test-paste-formats.sh    # Test all format types (simple, markdown, pretty, HTML)
./test-shortcuts.sh        # Test shortcuts daemon startup
./test-shortcuts-flow.sh   # Test full shortcut flow with permissions

# Manual tests (from swift-cli directory)
cd native/swift-cli
echo -e "Name\tAge\nJohn\t30" | ./.build/release/AiPasteHelper format --stdin
./.build/release/AiPasteHelper settings get
./.build/release/AiPasteHelper settings set outputFormat markdown
./.build/release/AiPasteHelper shortcuts --list
```

### Electron Tests
```bash
# Development mode
pnpm dev

# Build all
pnpm build

# Distribution build
pnpm dist

# Type checking
pnpm typecheck
```

## Architecture Reminders
- **Monorepo with pnpm workspaces** for package management
- **@aipaste/* namespace** for all packages
- Swift CLI handles all native macOS functionality
- TypeScript bridge manages process communication via IPC
- JSON protocol for type-safe Swift-TypeScript communication
- Next.js 15 with App Router for UI
- Electron 36 for desktop framework
- Centralized path configuration in `electron/main/config/paths.ts`

## Package Commands
```bash
# Run command in specific package
pnpm --filter @aipaste/electron <command>
pnpm --filter @aipaste/main-window <command>
pnpm --filter @aipaste/swift-cli <command>

# Run command in all packages
pnpm run --parallel <command>

# Install dependency in specific package
pnpm --filter @aipaste/ui add <package>
```

## Next Priority Tasks
1. **OCR Implementation** - Extract from TRex/AiPasteCore.swift
2. **EventTap Integration** - Keyboard shortcuts via Swift
3. **Permissions API** - Accessibility and screen recording
4. **History Manager** - Complete clipboard history tracking
5. **Settings Sync** - UI to Swift settings bridge

## Development Principles
- Port exact logic from original Swift code
- Test each component independently
- Document all implementations in agent-docs
- Update progress reports after each component
- Maintain backward compatibility
- Follow monorepo best practices
- Use workspace protocol for internal dependencies

## Common Issues & Solutions

### Build Issues
- **Swift build fails**: Check Package.swift syntax, ensure Xcode CLI tools installed
- **Electron build fails**: Run `pnpm install` at root, check node version >=20
- **Type errors**: Run `pnpm typecheck` to identify issues

### Runtime Issues
- **JSON parse error**: Ensure all Swift CLI output is valid JSON
- **Process not found**: Check paths in `electron/main/config/paths.ts`
- **IPC handler not found**: Verify registration in `electron/main/ipc-handlers/index.ts`
- **Swift binary missing**: Run `pnpm --filter @aipaste/electron swift:build`

### Monorepo Issues
- **Dependency not found**: Use workspace protocol: `"@aipaste/ui": "workspace:*"`
- **Build order**: Dependencies build automatically with pnpm
- **Version conflicts**: Check root package.json for overrides

## Important Context
This project ports features from two Swift apps:
1. **AiPaste** (`/Users/moinulmoin/Developer/clients/neutralbase/aipaste`) - Clipboard formatting
2. **TRex** (`/Users/moinulmoin/Developer/clients/neutralbase/angry-ants`) - OCR functionality

The goal is minimal Swift code for native features, with everything else in Electron/TypeScript.

## Workspace Dependencies
- Internal packages use `workspace:*` protocol
- Shared configs in `packages/config-typescript/`
- UI components in `packages/ui/` used by all apps
- All packages follow `@aipaste/` naming convention

## CI/CD Considerations
- All packages must pass `pnpm typecheck`
- All packages must pass `pnpm lint`
- Swift CLI must build in release mode
- Electron app must complete `pnpm dist`