# AiPaste Monorepo

A macOS desktop application that provides intelligent clipboard management with table formatting, OCR capabilities, and keyboard shortcuts. Built as a monorepo with Electron, Next.js, and a native Swift CLI for macOS integration.


## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and pnpm
- **Xcode** and Swift (for building the native CLI)
- **macOS** (required for native clipboard and permissions features)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd electron-aipaste
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the Swift CLI** (Required first!)
   ```bash
   pnpm --filter @aipaste/electron swift:build
   # or from root:
   pnpm swift:build
   ```

4. **Start the development server**
   ```bash
   pnpm dev
   ```

The application will open in Electron. On first launch, it will guide you through:
- Granting Accessibility permissions (required for keyboard shortcuts)
- Testing clipboard functionality
- Configuring table formatting preferences

## 📖 How to Use AiPaste

### 🚀 Getting Started

1. **First Launch**: The app will open an onboarding window
2. **Grant Permissions**: Click "Request Permissions" to enable:
   - **Accessibility**: Required for the Cmd+Shift+V keyboard shortcut
   - **Screen Recording**: May be needed for some clipboard operations
3. **Test Functionality**: The app will verify everything is working
4. **Choose Settings**: Pick your preferred table format and options

### 🎯 Basic Usage (Automatic Clipboard Formatting)

AiPaste works automatically in the background - no manual intervention needed!

1. **Copy Any Table**: 
   - Copy data from Excel, Google Sheets, Numbers, or any spreadsheet
   - Copy HTML tables from websites
   - Copy tab-delimited text from anywhere

2. **Automatic Detection**: 
   - AiPaste detects when you copy tabular data
   - It automatically formats the data based on your preferences
   - The formatted version replaces your clipboard content

3. **Paste Anywhere**: 
   - Use Cmd+V to paste the beautifully formatted table
   - Works in Slack, Discord, emails, documentation, anywhere!

### ⌨️ Using Keyboard Shortcuts

**Cmd+Shift+V** - Access Clipboard History

1. **Press the shortcut** while in any application
2. **Browse your history** - see all previously formatted tables
3. **Click any item** to copy it back to your clipboard
4. **Paste normally** with Cmd+V in your target application

### 📋 Working with Clipboard History

The history panel shows:
- **Formatted content preview**
- **Original timestamp** when you copied it
- **Format type** (Simple, Markdown, Pretty, HTML)
- **Click to copy** - instantly copies the item back to clipboard

### ⚙️ Customizing Your Experience

**Access Settings**: Click the settings icon in the dashboard or history panel

**Format Options**:
- **Simple**: Clean tab-delimited format (great for plain text)
- **Markdown**: GitHub-style tables (perfect for documentation)  
- **Pretty**: ASCII art tables with borders (nice for Slack/Discord)
- **HTML**: Full HTML markup (for web pages and rich text)

**Prefix Options**:
- Enable: Adds "Below is a table showing..." before your data
- Disable: Just the raw formatted table

**Process Management**:
- Start/Stop the background monitoring
- View real-time status
- Health monitoring

### 💡 Common Use Cases

- **Excel → Slack/Discord**: Auto-formats with borders for chat apps
- **Google Sheets → Documentation**: Markdown tables for GitHub/Notion
- **Website Tables → Email**: Clean conversion without messy HTML
- **Quick Reuse**: Press Cmd+Shift+V to access any previous table

### 🎨 Format Examples

**Markdown** (for documentation):
```
| Name | Age | City     |
|------|-----|----------|
| John | 30  | New York |
```

**Pretty** (for chat apps):
```
┌──────┬─────┬──────────┐
│ Name │ Age │ City     │
├──────┼─────┼──────────┤
│ John │ 30  │ New York │
└──────┴─────┴──────────┘
```

### 💡 Tips

**Performance**:
- The app uses minimal CPU when monitoring clipboard
- History is stored locally and privately
- No data ever leaves your computer

**Format Selection**:
- Use **Markdown** for documentation and GitHub
- Use **Pretty** for Slack, Discord, or terminal output  
- Use **Simple** for basic text applications
- Use **HTML** when pasting into rich text editors

**Managing History**:
- History persists between app restarts
- Items show timestamps for easy identification
- Most recent items appear at the top

**Troubleshooting**:
- If shortcuts stop working, check accessibility permissions
- If formatting seems off, try copying the original data again
- Use the dashboard to monitor real-time status

## 🏗️ Monorepo Structure

```
├── apps/
│   ├── main-window/     # Next.js UI (@aipaste/main-window)
│   └── menubar/        # Future menubar app
├── electron/           # Electron backend (@aipaste/electron)
│   ├── main/          # Main process
│   │   ├── swift-bridge.ts    # Swift CLI integration
│   │   └── process-manager.ts # Process management
│   └── preload/       # Preload scripts
├── native/            # Native modules
│   └── swift-cli/     # Swift CLI (@aipaste/swift-cli)
│       ├── Sources/   # Swift source code
│       │   └── AiPasteHelper/  # Main CLI implementation
│       └── Package.swift       # Swift package configuration
├── packages/          # Shared packages
│   ├── ui/           # UI components (@aipaste/ui)
│   └── config-typescript/ # Shared TypeScript configs
├── agent-docs/       # Development documentation and reports
└── pnpm-workspace.yaml # Workspace configuration
```

## 🛠️ Swift CLI Integration

AiPaste uses a native Swift CLI to handle macOS-specific features that require low-level system access.

### Building the Swift CLI

```bash
# Build for development (from root)
pnpm swift:build

# Or manually
cd native/swift-cli && swift build -c release
```

### Available CLI Commands

```bash
# Test CLI functionality
./.build/debug/AiPasteHelper test

# Format clipboard data (stdin)
echo -e "Name\tAge\nJohn\t30" | ./.build/debug/AiPasteHelper format --stdin

# Monitor clipboard changes (long-running)
./.build/debug/AiPasteHelper monitor

# Execute paste with formatting
./.build/debug/AiPasteHelper paste

# Manage settings
./.build/debug/AiPasteHelper settings get
./.build/debug/AiPasteHelper settings set prefix true

# Check system permissions
./.build/debug/AiPasteHelper permissions

# Start keyboard shortcut monitoring
./.build/debug/AiPasteHelper shortcuts
```

### Swift CLI Features

- **Table Formatting**: Converts tabular data from Excel/Google Sheets to various formats
- **Clipboard Monitoring**: Real-time detection of clipboard changes
- **Keyboard Shortcuts**: System-wide Cmd+Shift+V support
- **Settings Management**: JSON-based configuration
- **Permissions Checking**: Accessibility and screen recording permissions

### Communication Protocol

The Swift CLI communicates with Electron using JSON over stdout/stdin:

```typescript
// Electron → Swift CLI
spawn('AiPasteHelper', ['format', '--input', data])

// Swift CLI → Electron (JSON response)
{
  "success": true,
  "data": "formatted table data",
  "message": "Table formatted successfully"
}
```

## 📦 Monorepo Commands

### Package-specific Commands

```bash
# Run command in specific package
pnpm --filter @aipaste/electron <command>
pnpm --filter @aipaste/main-window <command>
pnpm --filter @aipaste/swift-cli <command>

# Examples
pnpm --filter @aipaste/electron build
pnpm --filter @aipaste/main-window dev
pnpm --filter @aipaste/ui add react-hook-form

# Run command in all packages
pnpm run --parallel <command>
```

### Common Development Commands

```bash
# Development (starts all apps)
pnpm dev

# Build all packages
pnpm build

# Build distribution
pnpm dist

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Clean all build artifacts
pnpm clean
```

## 🔧 Technologies

- **Frontend**: Next.js 15, React 19, TypeScript
- **Desktop**: Electron 36
- **Native Backend**: Swift CLI with macOS system integration
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis
- **Authentication**: Clerk / Better Auth (configurable)
- **AI**: Anthropic Claude / OpenAI (configurable)
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: Zustand
- **Build**: tsup, electron-builder, Swift Package Manager

## ✨ Key Features

### 📋 Intelligent Clipboard Management
- **Real-time Monitoring**: Automatically detects when you copy tabular data from Excel, Google Sheets, or any application
- **Auto-formatting**: Instantly converts tables to clean, readable formats
- **Multiple Formats**: Choose from Simple, Markdown, Pretty Table, or HTML formats
- **Smart Prefixes**: Optional descriptive text like "Below is a table showing..."

### ⌨️ Keyboard Shortcuts
- **Cmd+Shift+V**: Global shortcut to paste from clipboard history
- **System Integration**: Works across all applications system-wide
- **Permission Management**: Guided setup for Accessibility permissions

### 📊 Table Formatting Options
- **Simple**: Clean tab-delimited format
- **Markdown**: GitHub-style markdown tables
- **Pretty**: ASCII art tables with borders
- **HTML**: Full HTML table markup

### 💾 Clipboard History
- **Persistent Storage**: All formatted items saved locally
- **Click to Copy**: Easy access to previous clipboard items
- **Auto-formatting**: Historical items show in your preferred format
- **Metadata Tracking**: Timestamps and format information

### ⚙️ Settings & Configuration
- **Format Preferences**: Set your default table format
- **Prefix Control**: Enable/disable descriptive prefixes
- **Process Management**: Start/stop background monitoring
- **Permission Status**: Real-time permission monitoring

### 🖥️ Native macOS Integration
- **Swift CLI**: High-performance native backend
- **System Permissions**: Proper Accessibility and Screen Recording integration
- **Background Processing**: Minimal CPU usage with efficient monitoring
- **Auto-restart**: Robust process management with health monitoring

## 📝 Environment Variables

### Required Variables

```env
# Authentication
AUTH_SECRET=your-auth-secret

# Database
POSTGRES_URL="postgresql://postgres:password@localhost:5434/neutralbase_app"
```

### Optional Variables

The template includes additional features that require these variables:

```env
# Authentication Provider (choose one)
AUTH_PROVIDER=clerk # or better-auth
NEXT_PUBLIC_AUTH_PROVIDER=clerk # or better-auth

# Clerk (if using)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key

# Better Auth (if using)
BETTER_AUTH_SECRET=your-better-auth-secret
BETTER_AUTH_URL=your-better-auth-url

# Redis
REDIS_URL=your-redis-url

# File Storage
BLOB_READ_WRITE_TOKEN=your-blob-token

# Licensing (if using)
POLAR_ACCESS_TOKEN=your-polar-token
POLAR_SERVER=sandbox

# Usage Tracking (if using)
METRONOME_BEARER_TOKEN=your-metronome-token

# API
NEXT_PUBLIC_API_URL=your-api-url
```

## 🚀 Available Scripts

### Development
- `pnpm run dev` - Start the full Electron app with Swift CLI
- `pnpm run next:dev` - Start only the Next.js development server

### Swift CLI
- `pnpm run swift:build` - Build the Swift CLI component
- `pnpm run swift:test` - Test Swift CLI functionality (if available)

### Building
- `pnpm run build` - Build everything (Swift CLI + Electron + Next.js)
- `pnpm run dist` - Build and package the complete application
- `pnpm run electron:dist` - Create distribution packages

### Database
- `pnpm db:push` - Push database schema changes
- `pnpm db:push --force` - Force push schema changes
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio

### Code Quality
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run typecheck` - Run TypeScript type checking

### Setup
- `pnpm run setup` - Run automated setup script
- `pnpm run setup:interactive` - Run interactive setup script
- `pnpm run setup:validate` - Validate setup configuration

## 🧪 Testing the Application

### Quick Swift CLI Test
```bash
# Build the CLI first
pnpm run swift:build

# Test basic functionality
./.build/debug/AiPasteHelper test

# Test table formatting
echo -e "Name\tAge\nJohn\t30\nJane\t25" | ./.build/debug/AiPasteHelper format --stdin -o markdown
```

### Full Integration Test
1. **Start the app**: `pnpm run dev`
2. **Complete onboarding**: Grant permissions when prompted
3. **Test clipboard formatting**: Copy a table from Excel or Google Sheets
4. **Test keyboard shortcut**: Press `Cmd+Shift+V` to access clipboard history
5. **Check settings**: Use the settings panel to configure formats

## 🗃️ Database Setup

The application uses PostgreSQL as the primary database. When you run `pnpm run dev`, a PostgreSQL instance is automatically started within the Electron application.

### Database Commands

```bash
# Push schema changes (recommended for development)
pnpm db:push --force

# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open database studio
pnpm db:studio
```

## 🔌 Redis Integration

The application includes Redis for caching and session management. Redis binaries are included in the `resources/binaries/redis/` directory for cross-platform compatibility.

## 📱 Building for Production

### Build the application
```bash
pnpm run build
```

### Create distribution packages
```bash
pnpm run dist
```

### Platform-specific builds
```bash
# Debian package
pnpm run electron:dist:deb
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Troubleshooting

### Swift CLI Issues

**Swift build fails**: 
- Ensure Xcode is installed: `xcode-select --install`
- Check Swift version: `swift --version` (requires 5.9+)
- Try cleaning: `cd swift-cli && swift package clean && swift build`

**AiPasteHelper not found**:
- Build the CLI first: `pnpm run swift:build`
- Check binary exists: `ls -la swift-cli/.build/debug/AiPasteHelper`
- Verify permissions: `chmod +x swift-cli/.build/debug/AiPasteHelper`

**Permission issues**:
- Grant Accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility
- Add the Electron app or Terminal to the allowed apps list
- For Screen Recording permissions, add to the Screen Recording section

**Keyboard shortcuts not working**:
- Verify permissions are granted (use `AiPasteHelper permissions`)
- Check if another app is using Cmd+Shift+V
- Try restarting the shortcuts daemon: Stop and restart the app

### Electron/Node Issues

**Database connection issues**: Ensure PostgreSQL is running when you execute `pnpm db:push`. The easiest way is to have `pnpm run dev` running in another terminal.

**Port conflicts**: If you encounter port conflicts, check that ports 3000 (Next.js) and 5434 (PostgreSQL) are available.

**Environment variables**: Double-check that your `.env` file is properly configured with the required variables.

**Dependencies**: If you encounter dependency issues, try deleting `node_modules` and `pnpm-lock.yaml`, then run `pnpm install` again.

## 🏗️ Architecture & Development

### Application Architecture
```
┌─────────────────┐    JSON/IPC    ┌──────────────────┐
│   Electron UI   │ ◄─────────────► │   Swift CLI      │
│  (TypeScript)   │                │  (AiPasteHelper) │
├─────────────────┤                ├──────────────────┤
│ • Settings UI   │                │ • Clipboard Mon. │
│ • Dashboard     │                │ • Table Format   │
│ • History View  │                │ • Shortcuts      │
│ • Permissions   │                │ • Permissions    │
└─────────────────┘                └──────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────┐                ┌──────────────────┐
│   Next.js App   │                │  macOS System    │
│   (Frontend)    │                │   Integration    │
└─────────────────┘                └──────────────────┘
```

### Development Workflow
1. **Swift CLI Development**: Make changes in `swift-cli/Sources/AiPasteHelper/`
2. **Build Swift**: Run `pnpm run swift:build`
3. **Test CLI**: Use `./.build/debug/AiPasteHelper test`
4. **Electron Development**: Make changes in `src/main/` and `src/app/`
5. **Integration Testing**: Run `pnpm run dev` to test full integration

### Communication Flow
1. **User Action** (copy table, press shortcut)
2. **Swift CLI Detection** (clipboard monitoring, event tap)
3. **Processing** (table parsing, formatting)
4. **JSON Response** (structured data back to Electron)
5. **UI Update** (real-time status, history updates)

### File Organization
- **Swift CLI**: All native macOS functionality
- **Electron Main**: Process management, IPC handlers, Swift bridge
- **Next.js Frontend**: User interface, settings, dashboard
- **Agent Docs**: Development progress tracking and reports

### Getting Help

For additional support or questions about this template, please contact the development team.