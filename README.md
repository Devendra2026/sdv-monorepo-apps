# SDV Monorepo Apps

Next.js web app (`apps/web`) with Convex backend (`packages/backend`) and shared UI (`packages/ui`).

## Local setup

### 1. Install and run

```bash
pnpm install
pnpm dev
```

In a separate terminal, start the Convex dev server from the backend package:

```bash
cd packages/backend && npx convex dev
```

### 2. Environment variables

**Web app** (`apps/web/.env.local`):

| Variable                            | Purpose                   |
| ----------------------------------- | ------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key     |
| `CLERK_SECRET_KEY`                  | Clerk secret key (server) |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex deployment URL     |

**Convex deployment** (set via Dashboard or CLI):

| Variable                  | Purpose                             |
| ------------------------- | ----------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL (JWT issuer) |

Verify Convex env:

```bash
cd packages/backend && npx convex env get CLERK_JWT_ISSUER_DOMAIN
```

If unset, set it from the Clerk Convex integration page:

```bash
cd packages/backend && npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<your-clerk-frontend-api>"
```

Restart `npx convex dev` after changing Convex env vars.

### 3. Clerk + Convex auth (required)

Server-side Convex preloads and authenticated queries need a Clerk JWT template named exactly **`convex`**.

1. Open [Clerk Convex integration](https://dashboard.clerk.com/apps/setup/convex)
2. Activate the integration (creates the `convex` JWT template)
3. Copy the **Frontend API URL** and set it as `CLERK_JWT_ISSUER_DOMAIN` on your Convex deployment (see above)

The template name must match [`apps/web/lib/clerk-convex.ts`](apps/web/lib/clerk-convex.ts) and `applicationID: "convex"` in [`packages/backend/convex/auth.config.ts`](packages/backend/convex/auth.config.ts).

Without this setup you will see:

```
[convex-server] Clerk JWT template 'convex' not found
```

Authenticated server preloads fall back to client queries until the template exists.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
