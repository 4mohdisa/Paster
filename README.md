# Next.js + Electron Template

A full-stack desktop application template built with Next.js and Electron, featuring authentication, database integration, AI capabilities, and a modern UI.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nextjs-electron-template
   ```

2a. **Install dependencies**
   ```bash
   pnpm install
   ```

2b. **Reinstall electron if necessary**
On macOS, electron doesn't install properly
   ```bash
   pnpm install --dangerously-allow-all-builds
   ```
Or if you've already done pnpm install, simple run the following and select each build with space bar and then hit Enter
   ```bash
   pnpm approve-builds
   ```

3. **Set up environment variables**
   ```bash
   cp _env.example .env
   ```
   Not necessary to edit `.env` unless you wanted to add auth, license, usage, etc.

4. **Start the development server**
   ```bash
   pnpm run dev
   ```

5. **Initialize the database** (while the application is running)
   In a new terminal window:
   ```bash
   pnpm db:push --force
   ```

6. **Restart the development server**
   Exit the current `pnpm run dev` process and start it again:
   ```bash
   pnpm run dev
   ```

The application will open in Electron and will load the nextjs server at localhost:3000

## 🏗️ Project Structure

```
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components and UI library
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities, database, and AI modules
│   ├── main/            # Electron main process
│   ├── preload/         # Electron preload scripts
│   └── stores/          # State management
├── resources/           # Static resources and binaries
├── scripts/             # Setup and utility scripts
└── packages/            # Workspace packages
```

## 🛠️ Technologies

- **Frontend**: Next.js 15, React 19, TypeScript
- **Desktop**: Electron 36
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis
- **Authentication**: Clerk / Better Auth (configurable)
- **AI**: Anthropic Claude / OpenAI (configurable)
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: Zustand
- **Build**: tsup, electron-builder

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
- `pnpm run dev` - Start the Electron app in development mode
- `pnpm run next:dev` - Start only the Next.js development server

### Database
- `pnpm db:push` - Push database schema changes
- `pnpm db:push --force` - Force push schema changes
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio

### Building
- `pnpm run build` - Build the application for production
- `pnpm run dist` - Build and package the application
- `pnpm run electron:dist` - Create distribution packages

### Code Quality
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run typecheck` - Run TypeScript type checking

### Setup
- `pnpm run setup` - Run automated setup script
- `pnpm run setup:interactive` - Run interactive setup script
- `pnpm run setup:validate` - Validate setup configuration

## 🎯 Key Features

- **🔐 Authentication**: Configurable authentication with Clerk or Better Auth
- **💾 Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **⚡ Caching**: Redis integration for performance optimization
- **🤖 AI Integration**: Support for Anthropic Claude and OpenAI APIs
- **🎨 Modern UI**: Beautiful interface with Tailwind CSS and shadcn/ui
- **📱 Responsive**: Works seamlessly across different screen sizes
- **🔧 Type Safety**: Full TypeScript support throughout the stack
- **📦 Package Management**: Monorepo structure with pnpm workspaces

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

### Common Issues

**Database connection issues**: Ensure PostgreSQL is running when you execute `pnpm db:push`. The easiest way is to have `pnpm run dev` running in another terminal.

**Port conflicts**: If you encounter port conflicts, check that ports 3000 (Next.js) and 5434 (PostgreSQL) are available.

**Environment variables**: Double-check that your `.env.local` file is properly configured with the required variables.

**Dependencies**: If you encounter dependency issues, try deleting `node_modules` and `pnpm-lock.yaml`, then run `pnpm install` again.

### Getting Help

For additional support or questions about this template, please contact the development team.