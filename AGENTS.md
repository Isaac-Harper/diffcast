# Diffcast

Paid daily two host podcast for developers about their own stack, with a remote MCP server for agent context sync. Spun out of the podcast feature in `~/Development/cvzx`. Name Diffcast, chosen 2026-11-16; intended domain diffcast.fm (not yet bought; diffcast.dev is taken).

## Status

Phase 0 (prototype) in progress. Spec: `docs/agents/phase0-spec.md`. The web app (listeners, feeds, audio, feedback, gate dashboard, job API) is built and tested against mocks; no database, Blob store or env vars exist on Vercel yet, and the migration has not been applied. Plan and gates: `docs/agents/phases.md`. Product proposal: `docs/proposal.md`; the review that amends it: `docs/agents/advisory-2026-11-16.md` (read its Blocking section before touching privacy, TTS or the audio route).

## Stack

- Next.js 16 App Router, React 19, TypeScript strict (extra flags match cvzx), Tailwind 4, pnpm, Node 22.
- Prettier via `@monogram/prettier-config`, ESLint flat config from `eslint-config-next`, vitest (`vitest.config.mts`, `src/**/*.test.ts`).
- `cacheComponents` is on: anything reading cookies, headers, params or the database renders inside `<Suspense>` (the admin layout wraps every admin page in one).
- Neon Postgres via `@neondatabase/serverless` (`src/lib/db.ts`, tagged template `sql`). Dates are selected as `::text`. Migrations are plain SQL in `db/migrations/`, applied by `pnpm db:migrate` (tracked in `schema_migrations`).
- Private Vercel Blob store for audio. No response or page ever carries a raw Blob URL; listeners get 10 minute signed URLs through the audio route.
- `@shared/*` aliases `shared/` (the job API contract, `shared/contract.ts`). Root `tsconfig.json` excludes `tools/`, which has its own checks.
- Env vars: `.env.example` lists every one the app reads.
- Vercel project `diffcast` (`prj_vFI5gJAg6BtIDq0cg8lgcyMoCBAS`) in the personal team `isaacs-projects-b02601f4` (`team_SdyKzz4shtFWP7nhrEYgp8JK`). Git integration: pushing `main` deploys production.
- Production URL: https://diffcast-fm.vercel.app (diffcast.vercel.app belongs to someone else).
- GitHub `Isaac-Harper/diffcast`, public, MIT.

## File map

- `src/app/page.tsx`: placeholder landing page.
- `src/proxy.ts`: first gate. `/api/jobs/*` needs the bearer token (`src/lib/job-auth.ts`), `/admin` the session cookie; everything else passes to its handler. Route handlers and server actions check again.
- `src/app/api/jobs/{due,upload,episodes,failures}`: job API for the generator, bodies from `shared/contract.ts`. Due rule in `src/lib/due.ts`, assembly in `src/lib/jobs.ts`.
- `src/app/api/feed/[token]`, `src/app/api/audio/[token]/[file]`, `src/app/l/[token]`: listener surfaces keyed by a feed token (`src/lib/feed-tokens.ts`, lookup and miss throttle in `src/lib/feed-access.ts`). Every episode lookup is scoped to the token's listener.
- `src/app/admin/`: gate dashboard (home), listeners (form, stack paste, feed tokens), episodes (detail with spot checks), runs. `src/app/login/`: owner password login.
- `src/lib/`: pure rules (`time.ts`, `due.ts`, `feed.ts`, `stack-parser.ts`, `gate.ts`, `forms.ts`, `blob-rules.ts`, `session.ts`), Next and service glue (`auth.ts`, `blob.ts`, `http.ts`), queries in `store/`.
- `db/migrations/001_phase0.sql`, `db/migrate.mjs`: schema and runner.
- `public/cover.png`: 1400 square feed artwork.
- `docs/proposal.md`: original proposal (2026-11-15). Its name section recommends Lockfile; Diffcast was picked instead.
- `docs/agents/`: phase plan and advisory review.

## Checks

`pnpm lint`, `pnpm typecheck` (runs `next typegen` first for the route types), `pnpm test`, `pnpm format`, `pnpm build`. Route tests mock `@/lib/db`, the `store/` modules and `@/lib/blob` (`src/app/api/routes.test.ts`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
