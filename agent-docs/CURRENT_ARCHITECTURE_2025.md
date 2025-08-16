# AiPaste Monorepo - Current Architecture (2025)

**Document Version**: 2.0
**Date**: 2025-08-16
**Status**: Active

---

## Executive Summary

AiPaste is an Electron-based clipboard management application with native macOS capabilities, built as a monorepo using pnpm workspaces. The application features a hybrid architecture combining TypeScript/Electron for the UI and Swift for native macOS functionality.

---

## Monorepo Structure

```
aipaste-monorepo/
├── apps/                    # Application packages
│   ├── main-window/        # Next.js main application UI
│   └── menubar/           # Menubar application (placeholder)
├── electron/              # Electron backend service
│   ├── main/             # Main process code
│   │   ├── config/      # Configuration modules
│   │   ├── ipc-handlers/ # IPC communication handlers
│   │   └── utils/       # Utility functions
│   ├── preload/         # Preload scripts
│   └── resources/       # Application resources
├── native/              # Native platform code
│   └── swift-cli/      # Swift CLI for macOS operations
├── packages/           # Shared packages
│   ├── config-typescript/ # TypeScript configurations
│   └── ui/            # Shared UI components library
└── agent-docs/        # Project documentation

```

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Package Management** | pnpm | 9.15.0 | Workspace management, dependency efficiency |
| **UI Framework** | Next.js | 15.3.2 | React-based UI with server components |
| **Desktop Framework** | Electron | 36.2.1 | Cross-platform desktop application |
| **UI Components** | React | 19.1.0 | Component architecture |
| **Styling** | Tailwind CSS | 4.1.7 | Utility-first CSS framework |
| **Native Layer** | Swift | 5.x | macOS native functionality |
| **Type System** | TypeScript | 5.9.0 | Type safety across JavaScript code |

### Component Libraries

- **@radix-ui**: Headless UI components for accessibility
- **lucide-react**: Icon library
- **sonner**: Toast notifications
- **next-themes**: Theme management

---

## Architecture Patterns

### 1. Monorepo with Workspace Architecture

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'native/*'
  - 'electron'
```

**Benefits**:
- Shared dependencies and configurations
- Atomic commits across packages
- Unified versioning and release process
- Code reuse through internal packages

### 2. Package Naming Convention

All packages follow the `@aipaste/` namespace:
- `@aipaste/main-window` - Main UI application
- `@aipaste/electron` - Electron backend
- `@aipaste/ui` - Shared component library
- `@aipaste/swift-cli` - Native Swift CLI
- `@aipaste/typescript-config` - Shared TS configs

### 3. Hybrid Architecture Pattern

```
┌─────────────────────────────────────────┐
│         Electron Main Process           │
│  ┌────────────┐  ┌──────────────────┐  │
│  │ IPC Handlers│  │ Process Manager   │  │
│  └────────────┘  └──────────────────┘  │
└──────────────┬──────────────────────────┘
               │ IPC Bridge
               ▼
┌─────────────────────────────────────────┐
│         Renderer Process (Next.js)      │
│  ┌────────────┐  ┌──────────────────┐  │
│  │   React UI │  │  State Management │  │
│  └────────────┘  └──────────────────┘  │
└─────────────────────────────────────────┘
               │
               ▼ JSON Protocol
┌─────────────────────────────────────────┐
│         Swift CLI (AiPasteHelper)       │
│  ┌────────────┐  ┌──────────────────┐  │
│  │  Commands  │  │  macOS Native API │  │
│  └────────────┘  └──────────────────┘  │
└─────────────────────────────────────────┘
```

### 4. IPC Communication Architecture

```typescript
// Centralized IPC handler registration
electron/main/ipc-handlers/
├── index.ts           // Main registration point
├── swift.ts          // Swift CLI communication
├── process-manager.ts // Process lifecycle management
└── history.ts        // Clipboard history management
```

### 5. Configuration Management

**Centralized Path Configuration** (`electron/main/config/paths.ts`):
```typescript
class PathConfig {
  getSwiftBinaryPath(): string
  getHistoryPath(): string
  // Singleton pattern for consistent paths
}
```

---

## Key Components

### 1. Electron Backend (`@aipaste/electron`)

**Responsibilities**:
- Application lifecycle management
- IPC communication orchestration
- Swift CLI process management
- Window management
- Native system integration

**Key Files**:
- `main/index.ts` - Entry point and window creation
- `main/swift-bridge.ts` - Swift CLI communication wrapper
- `main/process-manager.ts` - Background process management
- `main/history-manager.ts` - Clipboard history tracking

### 2. Main Window Application (`@aipaste/main-window`)

**Architecture**: Next.js App Router with React Server Components

**Key Components**:
- `components/dashboard.tsx` - Main application dashboard
- `components/onboarding.tsx` - User onboarding flow
- `components/navigation-sidebar.tsx` - Navigation interface
- `components/providers/` - Context providers for themes and licensing

### 3. UI Component Library (`@aipaste/ui`)

**Pattern**: Headless component architecture with Radix UI

**Component Categories**:
- Form controls (Button, Input, Select, etc.)
- Layout components (Card, Sidebar, etc.)
- Feedback components (Alert, Toast, etc.)
- Data display (Table, Badge, etc.)

### 4. Swift CLI (`@aipaste/swift-cli`)

**Commands**:
```swift
AiPasteHelper/
├── main.swift          // CLI entry point
├── SettingsCommand.swift // Settings management
├── ShortcutsCommand.swift // Keyboard shortcut handling
└── TableFormatter.swift  // Data formatting utilities
```

---

## Data Flow

### 1. Clipboard Monitoring Flow
```
User Copy → System Clipboard → Swift Monitor → IPC → Electron → UI Update
```

### 2. Paste Formatting Flow
```
Shortcut Trigger → Swift EventTap → Format Data → Update Clipboard → Trigger Paste
```

### 3. Settings Synchronization
```
UI Change → IPC Handler → Swift CLI → UserDefaults → Confirmation → UI Update
```

---

## Development Workflow

### Scripts Organization

**Root Level** (`package.json`):
```json
{
  "scripts": {
    "dev": "Concurrent development of electron and main-window",
    "build": "Build all packages",
    "dist": "Create distribution package",
    "lint": "Parallel linting across packages",
    "typecheck": "Type checking across packages"
  }
}
```

**Package Level**:
- Each package has its own scripts for development, building, and testing
- Consistent script naming across packages

### Build Process

1. **Development**: Hot reload for both Electron and Next.js
2. **Production Build**: 
   - Next.js static build
   - Swift CLI release build
   - Electron packaging with electron-builder

---

## Best Practices & Standards

### 1. Code Organization
- **Feature-based structure** in applications
- **Component-based structure** in UI library
- **Domain-based structure** in backend services

### 2. Naming Conventions
- **Files**: kebab-case for files (`swift-bridge.ts`)
- **Components**: PascalCase for React components
- **Functions**: camelCase for functions and methods
- **Types/Interfaces**: PascalCase with descriptive names

### 3. TypeScript Standards
- Strict mode enabled
- Explicit type definitions for public APIs
- Shared type definitions in `utils/types.ts`

### 4. Error Handling
- Centralized logging through `logger.ts`
- Graceful error propagation through IPC
- User-friendly error messages in UI

### 5. Security Considerations
- Context isolation in Electron
- Sandboxed renderer processes
- Secure IPC communication patterns
- No direct node integration in renderer

---

## Future Considerations

### Recommended Improvements

1. **Dependency Injection**: Implement DI for better testability
2. **State Management**: Consider Redux/Zustand for complex state
3. **Testing Infrastructure**: Add unit and integration tests
4. **CI/CD Pipeline**: Automated testing and releases
5. **Documentation**: API documentation and developer guides

### Architectural Debt

1. **ProcessManager Refactoring**: Split responsibilities (SRP violation)
2. **Interface Layer**: Create abstraction between electron and native
3. **Configuration Management**: Environment-based configuration
4. **Error Recovery**: Implement circuit breaker patterns

---

## Appendix

### File Naming Standards

| Type | Pattern | Example |
|------|---------|---------|
| React Components | PascalCase.tsx | `Dashboard.tsx` |
| Utilities | kebab-case.ts | `swift-bridge.ts` |
| Types | kebab-case.ts | `types.ts` |
| Config | kebab-case.json/yaml | `tsconfig.json` |
| Documentation | SCREAMING_SNAKE_CASE.md | `ARCHITECTURE.md` |

### Version Management

- Monorepo version: 1.0.0
- Individual packages: 0.0.1 (pre-release)
- Coordinated releases through changesets (recommended)

---

**Document Maintenance**: This document should be updated with any significant architectural changes or decisions.