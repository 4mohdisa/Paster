# Convex Backend Functions

This directory contains the Convex schema and functions for the AiPaste desktop app.

## Architecture

AiPaste uses a **local-only Convex backend** for complete privacy and offline capability:
- All data stays on the user's machine
- No cloud dependencies or subscriptions
- SQLite database stored in `~/Library/Application Support/@aipaste/`

## Structure

- `schema.ts` - Database schema definition
- `functions/` - Convex functions (queries, mutations, actions)
- `_generated/` - Auto-generated TypeScript types

## How It Works

1. **Electron starts** → Automatically launches local Convex backend on port 52100
2. **Frontend connects** → Uses `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:52100`
3. **Data persistence** → SQLite database stores all clipboard history locally

## Development

```bash
# Start the app (Convex backend starts automatically)
pnpm dev

# Push schema/function changes to local backend
pnpm convex:dev

# Deploy functions to local backend
pnpm convex:deploy
```

Note: The admin key is stored in `.env.local` for security

## Example Functions

See the `functions/` directory for example queries and mutations.