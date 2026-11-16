# Diffcast

Paid daily two host tech and AI news podcast for developers, personalized by each listener's interests (topics with an optional take and note) with their stack as one extra signal, plus a planned remote MCP server for agent context sync. Tagline in use (proposed 2026-11-16): "What changed in your corner of tech since yesterday." Spun out of the podcast feature in `~/Development/cvzx`. Name Diffcast, chosen 2026-11-16; domain diffcast.fm (bought at Porkbun 2026-11-16; diffcast.dev is taken).

## Status

Phase 0 (prototype) deployed 2026-11-16. Spec: `docs/agents/phase0-spec.md`. Web app live with Neon and a private Blob store; migrations 001 to 003 applied; generator runs hourly on fw13. An end to end `--smoke` run from fw13 against production passed (its episode was then deleted). The generator (`tools/generator`, details in its README) runs on the AI SDK through Vercel AI Gateway (key `AI_GATEWAY_API_KEY`): a research tool loop (gateway Parallel Search plus a local `fetch_page`) ending in structured notes, a separate writing call from the notes, and Fish Audio S2.1 Pro voice, with each model set by env (defaults: research `google/gemini-3.8-flash`, writer `anthropic/claude-sonnet-5-5` because Gemini Flash broke the write for the ear and challenge rules, voice `fish-audio/s2.1-pro`). Costs in the metrics are the billed amounts the gateway reports. A real 10 minute run on 2026-11-16 cost about $0.34 all Gemini and about $0.38 with the Sonnet writer at low reasoning (about $0.45 at its default reasoning) (was about $1.31 on Sonnet 5.5 research and ElevenLabs). Plan and gates: `docs/agents/phases.md`. Product proposal: `docs/proposal.md`; the review that amends it: `docs/agents/advisory-2026-11-16.md` (read its Blocking section before touching privacy, TTS or the audio route).

## Operations

- Vercel env: Neon vars (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, ...) from the Marketplace resource `diffcast-db`, `BLOB_READ_WRITE_TOKEN` from the private store `diffcast-audio`, plus `DIFFCAST_ADMIN_PASSWORD`, `DIFFCAST_SESSION_SECRET`, `DIFFCAST_JOB_TOKEN`. `DIFFCAST_GATE_START` is set when the 10 weekday window begins. `vercel env pull` fills `.env.local`; local and production share one database, so `pnpm db:migrate` locally migrates production.
- Mac Keychain: `diffcast-admin` (admin password), `diffcast-job-token`, `diffcast-feed-isaac` and `diffcast-page-isaac` (Isaac's own feed and listener page URLs).
- fw13: checkout `~/diffcast`, secrets `/etc/diffcast/env` (root, 0600: `DIFFCAST_URL`, `DIFFCAST_JOB_TOKEN`, `DIFFCAST_WORK_DIR=/home/isaach/diffcast-work`, `AI_GATEWAY_API_KEY`: gateway key `diffcast-fw13` with a $50 monthly budget). Pending before the AI SDK generator reaches fw13: remove `ELEVENLABS_API_KEY`, `DIFFCAST_TTS_USD_PER_1K_CHARS`, `DIFFCAST_MODEL`, `DIFFCAST_TTS_MODEL` and the ElevenLabs `DIFFCAST_HOST_VOICE`/`DIFFCAST_COHOST_VOICE` ids from that file so the Fish Audio defaults apply; ElevenLabs voice ids there break voicing. Service `diffcast-generator` plus hourly timer at :05 in `~/.config/nixos/server.nix` (fw13 flake commit 2921fb0); it pulls `main` and installs with `corepack pnpm@10.33.0` (system pnpm is 9) before each run. Logs: `journalctl -u diffcast-generator`. Manual run: `sudo systemctl start diffcast-generator`.
- Production URL `https://diffcast-fm.vercel.app`. Admin at `/admin`.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict (extra flags match cvzx), Tailwind 4, pnpm, Node 22.
- Prettier via `@monogram/prettier-config`, ESLint flat config from `eslint-config-next`, vitest (`vitest.config.mts`, `src/**/*.test.{ts,tsx}`; component tests opt into jsdom with a `// @vitest-environment jsdom` docblock, setup in `src/test/setup.ts`).
- `cacheComponents` is on: anything reading cookies, headers, params or the database renders inside `<Suspense>` (the admin layout wraps every admin page in one).
- Neon Postgres via `@neondatabase/serverless` (`src/lib/db.ts`, tagged template `sql`, and `transaction([...])` for several statements at once). Dates are selected as `::text`. Migrations are plain SQL in `db/migrations/`, applied by `pnpm db:migrate` (tracked in `schema_migrations`).
- Private Vercel Blob store for audio. No response or page ever carries a raw Blob URL; listeners get 10 minute signed URLs through the audio route.
- `@shared/*` aliases `shared/` (the job API contract, `shared/contract.ts`). Root `tsconfig.json` excludes `tools/`, which has its own checks.
- Env vars: `.env.example` lists every one the app reads.
- Vercel project `diffcast` (`prj_vFI5gJAg6BtIDq0cg8lgcyMoCBAS`) in the personal team `isaacs-projects-b02601f4` (`team_SdyKzz4shtFWP7nhrEYgp8JK`). Git integration: pushing `main` deploys production.
- Production URL: https://diffcast-fm.vercel.app (diffcast.vercel.app belongs to someone else).
- GitHub `Isaac-Harper/diffcast`, public, MIT.

## File map

- `src/app/page.tsx`: public landing page, composed from `src/app/landing/` (hero with the sample brief panel, how it works, episode anatomy with sample show notes, privacy summary, planned pricing, FAQ accordion, waitlist form). Header and footer in `src/app/components/site-chrome.tsx`, shared with `src/app/privacy/page.tsx`.
- `src/app/waitlist/actions.ts`: `joinWaitlist` (honeypot field `website`, per IP throttle, zod validation in `src/lib/waitlist.ts`, duplicate emails answer like a new join). Table `waitlist` in `db/migrations/002_waitlist.sql`, queries in `src/lib/store/waitlist.ts`. `/admin/waitlist` lists entries; Invite opens `/admin/listeners/new?waitlist=<id>` prefilled (name from the email, interests text into focus, stack text), and `saveListener` stamps `invited_at` from the hidden `waitlistId` field.
- `src/app/components/`: shared UI built on UI SDK parts: `SubmitButton`, `FormStatus`, `CopyButton`, `ChoiceGroup` (radio group as chips), `SelectField`, `ConfirmAction` (alert dialog that runs a server action, then a toast), `Toaster` (mounted in the admin layout), `Wordmark`, `SegmentList`.
- Metadata: `src/lib/site.ts` (name, tagline, description, `SITE_URL` `https://diffcast.fm`, `CONTACT_EMAIL`), `src/app/opengraph-image.tsx` and `apple-icon.tsx` (drawn in `brand-image.tsx`), `icon.svg`, `robots.ts` (disallows `/l/`, `/admin`, `/login`, `/api/`), `sitemap.ts` (`/` and `/privacy` only).
- Interests editor: `src/app/components/interests-editor.tsx` (add, remove, move up or down, active switch, optional take and note; posts `INTEREST_FIELDS` plus the marker field from `src/lib/interests-form.ts`). In the admin listener form it saves with the listener through `saveListener` (interests are only replaced when the marker field is posted; a new listener starts from `DEFAULT_INTERESTS`). On `/l/[token]` listeners edit their own through `saveMyInterests`, which goes through `feedAccess` and saves only for the token's listener. At least one interest is required.
- `src/proxy.ts`: first gate. `/api/jobs/*` needs the bearer token (`src/lib/job-auth.ts`), `/admin` the session cookie; everything else passes to its handler. Route handlers and server actions check again.
- `src/app/api/jobs/{due,upload,episodes,failures}`: job API for the generator, bodies from `shared/contract.ts`. Due rule in `src/lib/due.ts`, assembly in `src/lib/jobs.ts`.
- `src/app/api/feed/[token]`, `src/app/api/audio/[token]/[file]`, `src/app/l/[token]`: listener surfaces keyed by a feed token (`src/lib/feed-tokens.ts`, lookup and miss throttle in `src/lib/feed-access.ts`; every surface, the page and its actions included, goes through `feedAccess`, which checks the throttle before the lookup). Every episode lookup is scoped to the token's listener. A token works only while it is unrevoked and its listener is active.
- `src/app/admin/`: every page and action calls `requireSession()` itself, on top of the layout and proxy. Gate dashboard (home; episodes with `metrics.model` `smoke` and their spot checks are left out of every metric), listeners (form, stack paste, feed tokens), episodes (detail with spot checks), runs. `src/app/login/`: owner password login.
- `src/lib/`: pure rules (`time.ts`, `due.ts`, `feed.ts`, `stack-parser.ts`, `interests.ts`, `gate.ts`, `forms.ts`, `blob-rules.ts`, `session.ts`), Next and service glue (`auth.ts`, `blob.ts`, `http.ts`), queries in `store/`.
- Interests: `interests` table (per listener, unique topic case insensitive, `sort` order, `active`). `src/lib/interests.ts` holds `DEFAULT_INTERESTS` and `parseInterestRows`, which reads an editor posting parallel fields `topic[]`, `take[]`, `note[]`, `active[]` (`INTEREST_FIELDS`; `active[]` is `true` or `false` per row, so every row posts all four). `src/lib/store/interests.ts`: `listInterests`, `activeInterests` (one query for the due list), `saveInterests` (replaces the set in a transaction). `addListener` seeds the defaults. The due list sends each listener's active interests in sort order.
- Segment kinds (`shared/contract.ts`): `news`, `stack` (only when something real changed in their packages), `update`, `challenge` (tests a take, quoted in `challenges`), `wildcard`, `watch`. Every segment carries `topics` (interests it serves). Episodes saved before 2026-11-16 lack `challenges` and `topics` in their stored segments; readers of stored segments must not assume them.
- `db/migrations/` (`001_phase0.sql`, `002_waitlist.sql`, `003_interests.sql`, which seeds the defaults for existing listeners), `db/migrate.mjs`: schema and runner.
- `public/cover.png`: 1400 square feed artwork (dark tile, the two diff bars, wordmark, tagline); redraw it if the tagline changes.
- `docs/proposal.md`: original proposal (2026-11-15). Its name section recommends Lockfile; Diffcast was picked instead.
- `docs/agents/`: phase plan and advisory review.

## Design system

- Tokens live on `:root` in `src/app/globals.css` as `light-dark()` pairs, so dark mode follows `prefers-color-scheme` with no `dark:` variants. Tailwind color names: `bg`, `surface`, `sunken`, `fg`, `muted`, `line`, `edge` (control borders, 3:1), `add` and `add-soft` (green: success, additions), `del` and `del-soft` (red: errors, removals), `warn-soft`, `warn-line`. Never use Tailwind palette colors.
- Type: Geist for text, Geist Mono for labels, metadata and code. Sizes `text-display` and `text-title` are fluid. Radius: `rounded-control` (6px) for controls, `rounded-card` (10px) for cards.
- Every interactive control is a UI SDK part (`@ui-sdk/react/*`, skill in `.claude/skills/ui-sdk`; read `node_modules/@ui-sdk/react/docs/llms.txt` first). `@layer ui-sdk;` sits above the Tailwind import and `@ui-sdk/core/web.css` is imported into `layer(components)` and themed through the `--ui-*` tokens. Button variants are data attributes: `data-variant="solid" | "destructive" | "quiet"`, `data-size="lg"`.
- Classes: `.card`, `.table-frame` around `table.data-table`, `.code-chip`, `.honeypot`. The diff motif (a red bar over a longer green bar, `+` and `-` gutters) is the brand mark; keep it to the wordmark, the hero panel and semantic states.
- Trap: the CSS pipeline drops `flex-direction: row` as a default value, so overriding a column flex from `web.css` needs `flex-flow: row wrap`.

## Checks

`pnpm lint`, `pnpm typecheck` (runs `next typegen` first for the route types), `pnpm test`, `pnpm format`, `pnpm build`. Route tests mock `@/lib/db`, the `store/` modules and `@/lib/blob` (`src/app/api/routes.test.ts`). Forms carry the UI SDK agent test (`src/app/landing/waitlist-form.test.tsx`, `src/app/l/[token]/forms.test.tsx`): every control named and settable through `createAgent`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
