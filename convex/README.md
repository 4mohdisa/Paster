# Convex Backend Functions

This directory contains the Convex schema and functions shared across all apps in the monorepo.

## Structure

- `schema.ts` - Database schema definition
- `functions/` - Convex functions (queries, mutations, actions)
- `_generated/` - Auto-generated TypeScript types (created by `npx convex dev`)

## Usage

### From Electron App
The Electron app runs a local Convex backend on ports 52100-52101 and connects automatically.

### From Web Apps
Web apps can connect to either:
1. The local Electron backend (when running on same machine)
2. A cloud-hosted Convex instance (for production)

## Development

1. **With Electron (local backend)**:
   ```bash
   # Backend starts automatically with Electron
   pnpm dev
   
   # To push functions to local backend:
   npx convex dev --url http://127.0.0.1:52100 --admin-key <key>
   ```

2. **With Cloud Convex**:
   ```bash
   npx convex dev
   ```

## Example Functions

See the `functions/` directory for example queries and mutations.