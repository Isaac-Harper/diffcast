# Diffcast

Paid daily two host podcast for developers about their own stack, with a remote MCP server for agent context sync. Spun out of the podcast feature in `~/Development/cvzx`. Name Diffcast, chosen 2026-11-16; intended domain diffcast.fm (not yet bought; diffcast.dev is taken).

## Status

Phase 0 (prototype) not started. The repo is a Next.js 16 skeleton with a placeholder landing page. Plan and gates: `docs/agents/phases.md`. Product proposal: `docs/proposal.md`; the review that amends it: `docs/agents/advisory-2026-11-16.md` (read its Blocking section before touching privacy, TTS or the audio route).

## Stack

- Next.js 16 App Router, React 19, TypeScript strict (extra flags match cvzx), Tailwind 4, pnpm, Node 22.
- Prettier via `@monogram/prettier-config`, ESLint flat config from `eslint-config-next`, vitest.
- Vercel project `diffcast` (`prj_vFI5gJAg6BtIDq0cg8lgcyMoCBAS`) in the personal team `isaacs-projects-b02601f4` (`team_SdyKzz4shtFWP7nhrEYgp8JK`). Git integration: pushing `main` deploys production.
- GitHub `Isaac-Harper/diffcast`, public, MIT.

## File map

- `src/app/page.tsx`: placeholder landing page.
- `docs/proposal.md`: original proposal (2026-11-15). Its name section recommends Lockfile; Diffcast was picked instead.
- `docs/agents/`: phase plan and advisory review.

## Checks

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`, `pnpm build`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
