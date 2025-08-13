# 🚀 Monorepo Migration Plan with Local Convex Backend

## Executive Summary
Migrating from single Electron app to pnpm workspace monorepo with dual frontends and local Convex backend.

---

## 🎯 Current State Analysis

### Existing Architecture
```
Current Stack:
- Frontend: Next.js 15.3 with Turbopack
- Database: PostgreSQL + Drizzle ORM
- Cache: Redis
- Auth: Better-Auth
- Native: Swift CLI for macOS features
- Process: Electron main process orchestrator
```

### Dependencies to Migrate
- **Data Layer**: 43 tables/queries in Drizzle → Convex functions
- **Auth System**: Better-Auth + Clerk → Convex Auth
- **Cache Layer**: Redis → Convex real-time subscriptions
- **UI Components**: 30+ Radix UI components → Shared package

---

## 🏗️ Target Architecture

### Monorepo Structure
```
electron-aipaste/
├── apps/
│   ├── main-window/          # Next.js AI Chat (150MB)
│   └── menubar-app/          # Vite Clipboard (50MB)
├── packages/
│   ├── @aipaste/ui/          # Shared components
│   ├── @aipaste/core/        # Business logic
│   └── @aipaste/config/      # Tailwind + TypeScript
├── convex/                   # Local backend
├── electron/                 # Main process
└── swift-cli/               # Native features
```

---

## 🔄 Convex Local Backend Strategy

### 1. Local Development Setup
```typescript
// convex.json - Local configuration
{
  "functions": "convex/",
  "localBackend": true,  // Forces local mode
  "authConfig": {
    "providers": ["anonymous", "email"]
  }
}
```

### 2. Data Persistence
```typescript
// Local data stored in:
// .convex/local.db (SQLite under the hood)
// .convex/backups/ (automatic backups)
```

### 3. Process Management
```typescript
class ConvexManager {
  private process: ChildProcess;
  
  async start() {
    // Start local Convex backend
    this.process = spawn('npx', ['convex', 'dev', '--once', '--local'], {
      env: {
        CONVEX_LOCAL_BACKEND: 'true',
        CONVEX_DEPLOYMENT: 'local',
        DATABASE_URL: 'file:.convex/local.db'
      }
    });
  }
}
```

---

## 📊 Data Migration Strategy

### Phase 1: Schema Translation
```typescript
// Drizzle Schema (Current)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at')
});

// ↓ Converts to ↓

// Convex Schema (Target)
export default defineSchema({
  users: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"])
});
```

### Phase 2: Migration Script
```typescript
// scripts/migrate-to-convex.ts
async function migrateData() {
  // 1. Export from PostgreSQL
  const pgData = await db.select().from(tables);
  
  // 2. Transform data format
  const convexData = transformToConvex(pgData);
  
  // 3. Import to Convex
  await ctx.db.insert("tables", convexData);
}
```

---

## 🔄 State Synchronization Architecture

### Inter-App Communication
```typescript
// electron/main/state-bridge.ts
class StateBridge extends EventEmitter {
  private convexClient: ConvexClient;
  
  // Broadcast state changes to all windows
  broadcastUpdate(table: string, data: any) {
    this.mainWindow?.webContents.send('state:update', { table, data });
    this.menubarWindow?.webContents.send('state:update', { table, data });
  }
  
  // Subscribe to Convex real-time updates
  subscribeToUpdates() {
    this.convexClient.subscribe(
      api.clipboard.watchHistory,
      {},
      (data) => this.broadcastUpdate('clipboard', data)
    );
  }
}
```

### Frontend Sync Hook
```typescript
// packages/core/hooks/useSharedState.ts
export function useSharedState<T>(table: string) {
  const [state, setState] = useState<T>();
  
  useEffect(() => {
    // Listen for IPC updates
    window.electron.ipcRenderer.on('state:update', (event, { table: t, data }) => {
      if (t === table) setState(data);
    });
    
    // Also subscribe directly to Convex
    return convex.subscribe(table, setState);
  }, [table]);
  
  return state;
}
```

---

## 🚀 Migration Phases

### Phase 1: Foundation (Week 1)
```bash
# Tasks:
1. ✅ Set up pnpm workspace
2. ✅ Install Convex locally
3. ✅ Create packages structure
4. ✅ Configure TypeScript paths
```

### Phase 2: Backend Migration (Week 2)
```bash
# Tasks:
1. ⏳ Define Convex schema
2. ⏳ Migrate auth system
3. ⏳ Create data migration scripts
4. ⏳ Test data integrity
```

### Phase 3: Frontend Split (Week 3)
```bash
# Tasks:
1. ⏳ Extract shared components
2. ⏳ Create menubar app
3. ⏳ Set up routing
4. ⏳ Configure build pipelines
```

### Phase 4: Integration (Week 4)
```bash
# Tasks:
1. ⏳ Wire up IPC channels
2. ⏳ Test state sync
3. ⏳ Optimize performance
4. ⏳ Production build
```

---

## ⚠️ Risk Mitigation

### Critical Risks & Solutions

#### 1. Convex Local Limitations
**Risk**: Convex designed for cloud, local mode experimental
**Solution**: 
```typescript
// Fallback to SQLite if Convex fails
class DatabaseAdapter {
  async connect() {
    try {
      return await connectConvex();
    } catch {
      return await connectSQLite(); // Fallback
    }
  }
}
```

#### 2. Memory Overhead
**Risk**: Two React apps = 300MB+ RAM
**Solution**:
```typescript
// Lazy load menubar app
if (userOpensMenubar) {
  createMenubarWindow();
} else {
  // Keep dormant until needed
}
```

#### 3. Build Complexity
**Risk**: Complex dependency graph
**Solution**:
```json
// turbo.json for smart builds
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

---

## 🛠️ Development Workflow

### Local Development
```bash
# Terminal 1: Convex Backend
pnpm convex:dev

# Terminal 2: Main Window
pnpm --filter main-window dev

# Terminal 3: Menubar App  
pnpm --filter menubar-app dev

# Terminal 4: Electron
pnpm electron:dev
```

### Build Pipeline
```bash
# Parallel builds with caching
pnpm build:all

# Specific app
pnpm --filter @aipaste/main-window build
```

---

## 📈 Performance Targets

### Metrics to Maintain
```
- Startup time: < 3 seconds
- Memory usage: < 400MB total
- IPC latency: < 10ms
- Build time: < 2 minutes
```

### Monitoring
```typescript
// electron/main/performance.ts
class PerformanceMonitor {
  trackStartup() {
    console.time('app:ready');
    // Track each component
  }
  
  trackMemory() {
    setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > 400_000_000) {
        console.warn('Memory threshold exceeded');
      }
    }, 30000);
  }
}
```

---

## 🔒 Security Considerations

### IPC Security
```typescript
// electron/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  // Whitelist specific methods
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
    write: (data) => ipcRenderer.invoke('clipboard:write', sanitize(data))
  }
});
```

### Process Isolation
```typescript
// Each app runs in separate context
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true
}
```

---

## 📝 Implementation Checklist

### Week 1 - Foundation
- [ ] Initialize pnpm workspace
- [ ] Set up Convex with local backend
- [ ] Create base package structure
- [ ] Configure shared TypeScript config
- [ ] Set up shared ESLint/Prettier

### Week 2 - Data Layer
- [ ] Design Convex schema
- [ ] Create migration scripts
- [ ] Implement auth in Convex
- [ ] Test data persistence
- [ ] Set up backup strategy

### Week 3 - Frontend Split
- [ ] Extract UI components to package
- [ ] Create menubar app with Vite
- [ ] Implement shared hooks
- [ ] Configure routing
- [ ] Test hot reload

### Week 4 - Integration
- [ ] Implement state bridge
- [ ] Wire up all IPC channels
- [ ] Test cross-app communication
- [ ] Optimize bundle sizes
- [ ] Create production builds

### Week 5 - Testing & Deploy
- [ ] E2E tests across apps
- [ ] Performance testing
- [ ] Security audit
- [ ] Documentation
- [ ] Production deployment

---

## 🎯 Success Criteria

1. **Functionality**: All current features work
2. **Performance**: No degradation vs current
3. **Developer Experience**: Hot reload works
4. **Maintainability**: Clear separation of concerns
5. **Reliability**: Graceful error handling

---

## 🚨 Rollback Plan

If migration fails:
1. Git branch protection on main
2. Database backups before migration
3. Feature flags for gradual rollout
4. Parallel run old/new for validation
5. One-command rollback script

---

## 📊 Decision Matrix

| Aspect | Current (Single App) | Proposed (Monorepo) | Winner |
|--------|---------------------|---------------------|---------|
| Memory | 200MB | 400MB | Current ✅ |
| Modularity | Low | High | Proposed ✅ |
| Build Time | 1 min | 2 min | Current ✅ |
| Code Reuse | Low | High | Proposed ✅ |
| Complexity | Medium | High | Current ✅ |
| Scalability | Low | High | Proposed ✅ |
| **Overall** | 3 | 3 | **Tie** |

### Recommendation
Proceed with monorepo **IF**:
1. Team size > 3 developers
2. Planning more apps/features
3. Need independent deployment
4. Willing to accept complexity

Otherwise, optimize current architecture.

---

## 📚 Next Steps

1. **Review this plan** with team
2. **Prototype** Convex local setup
3. **Test** state synchronization
4. **Benchmark** performance impact
5. **Make GO/NO-GO decision**

---

*Document Version: 1.0*
*Last Updated: 2025-01-13*
*Status: Planning Phase*