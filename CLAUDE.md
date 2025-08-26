# Claude Code Project Configuration - AiPaste Monorepo

## Project Overview
AiPaste is a **universal intelligent paste application** for macOS that transforms any clipboard content into clean, readable text. It handles spreadsheets, documents (via Kash), and will soon support OCR. Built with Electron + Swift CLI in a monorepo architecture.

## Current Status
- **Phase**: Production Ready
- **Completion**: 98%
- **Remaining**: OCR implementation from TRex
- **Last Updated**: 2025-01-26

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

## Required Documentation to Check

### When Starting ANY Work
**ALWAYS READ FIRST:**
1. `agent-docs/PROJECT_OVERVIEW.md` - Understand the complete system
2. `agent-docs/WORK_HOOKS_PROTOCOL.md` - Follow development procedures

### Additional References
For more detailed documentation, see `agent-docs/` folder.

### Before Starting Work
1. Read PROJECT_OVERVIEW.md for understanding
2. Follow WORK_HOOKS_PROTOCOL.md procedures
3. Verify builds: `pnpm build` (includes Swift CLI)
4. Check what's remaining: OCR implementation is the main task

### After Completing Work
1. Update relevant documentation if you changed architecture
2. Run tests: `cd native/swift-cli/tests && ./test-cli.sh`
3. Ensure everything builds: `pnpm build`
4. Test the full app: `pnpm dev`

## Key Files to Track
- `agent-docs/PROJECT_OVERVIEW.md` - **START HERE** - Complete project guide
- `native/swift-cli/Sources/AiPasteHelper/` - Swift CLI implementation
- `electron/main/swift-bridge.ts` - TypeScript-Swift communication
- `electron/main/process-manager.ts` - Daemon management
- `convex/` - Database functions for clipboard history
- `apps/main-window/src/components/` - UI components

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

## Next Steps
See `agent-docs/PROJECT_OVERVIEW.md` for current status and remaining work.

## Development Principles
- Test changes before committing
- Keep documentation updated if architecture changes
- Follow existing code patterns
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