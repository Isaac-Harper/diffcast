# Phase 0 spec: prototype for 6 to 8 listeners

Goal: run real weekday episodes for Isaac plus 6 to 8 developers for 10 weekdays and measure the Phase 0 gate (`phases.md`). Two parts: the web app on Vercel (listeners, feeds, audio, feedback, gate dashboard, job API) and the generator on fw13 (research, script, voice, mix, upload). They meet only through the job API, whose bodies are defined once in `shared/contract.ts`. Neither part changes that file without the other side agreeing.

## Shared contract (`shared/contract.ts`)

zod schemas for every job API body. Both the web app (`@/../shared/contract` or a `@shared/*` path alias) and the generator import it; the generator copies nothing.

Speakers `host` (Mara) and `cohost` (Theo). Segment kinds: `news` (something happened), `stack` (a real release, breaking change, deprecation or advisory in the listener's packages), `update` (a development on a story the listener already heard), `challenge` (a story that tests one of the listener's takes), `wildcard` (an adjacent pick that connects back to their interests), `watch` (upcoming release, decision or deadline). Every segment has `challenges` (the take it pushes on, quoted, or null), `topics` (interest topics it serves) and `packages` (empty unless it touches their packages). `storyCount` is the number of real, dated, sourced stories found for the listener today, wildcard excluded; the generator never pads to reach a count. Due listeners carry `interests` (active ones in sort order: topic, take, note).

## Web app (`src/`, `db/`)

### Database (Neon Postgres, `@neondatabase/serverless`, `DATABASE_URL`)

Plain SQL migrations in `db/migrations/NNN_name.sql` applied by `db/migrate.mjs` (port the runner from `~/Development/cvzx/db/migrate.mjs`: a `schema_migrations` table keyed by full filename). One migration `001_phase0.sql`:

- `listeners`: id, name, email (nullable), timezone (IANA, validated with `Intl.DateTimeFormat`), stack jsonb (array of `dependencySchema`), focus text (what they work on, in their words, max 2000), minutes int default 10, active bool default true, created_at.
- `feed_tokens`: id, listener_id fk, label, token_hash unique (SHA-256 hex of a 32 byte random hex token), created_at, revoked_at, last_fetched_at, last_user_agent (200 chars), fetch_count. Only the hash is stored; the token is shown once.
- `episodes`: id, listener_id fk, published_on date, unique (listener_id, published_on), title, summary, story_count, segments jsonb, turns jsonb, metrics jsonb, audio_url, audio_bytes, duration_seconds, created_at, updated_at.
- `downloads`: id, episode_id fk, feed_token_id fk, at, method (GET or HEAD), user_agent. One row per GET at most once per hour per episode per token; HEAD not recorded.
- `feedback`: id, episode_id fk, listened (yes, partly, no), useful (up, down, null), note (max 2000), created_at. Latest per episode counts.
- `surveys`: id, listener_id fk, would_pay (yes, maybe, no), note, created_at. Latest per listener counts.
- `segment_checks`: id, episode_id fk, segment_index, verdict (correct, error, unclear), note, checked_at; unique (episode_id, segment_index).
- `job_runs`: id, listener_id fk, run_on date, status (ok, fail), step (null when ok), message, at.

Later migrations: `002_waitlist.sql` (waitlist), `003_interests.sql`: `interests` (id, listener_id fk on delete cascade, topic 1 to 100, take up to 500 or null, note up to 500 or null, active bool default true, sort int, created_at; unique (listener_id, lower(topic))). Existing listeners are seeded with the defaults (AI models and agents; Developer tools and web development; Startups and the tech industry; Security and privacy; Open source; Hardware and chips), and new listeners get them on creation.

### Auth

- Admin (`/admin/*`, `/api/admin/*` if any): one owner password `DIFFCAST_ADMIN_PASSWORD`, signed session cookie (HMAC with `DIFFCAST_SESSION_SECRET`, 30 days, httpOnly, secure, sameSite lax), login throttle per IP. Port the approach from `~/Development/cvzx/src/lib/session.ts`, `auth.ts` and `login-throttle.ts`, without TOTP. Enforced in `src/proxy.ts` (Next 16 replacement for middleware) and again in every admin server action and route.
- Job API (`/api/jobs/*`): `Authorization: Bearer $DIFFCAST_JOB_TOKEN`, constant time compare, at least 32 characters or every request is 401, never accepts the cookie.
- Listener surfaces (`/api/feed/<token>`, `/api/audio/<token>/<episodeId>.mp3`, `/l/<token>`): the feed token in the URL. Look up by hash; revoked or unknown is 404 with a per IP miss throttle. Every lookup of an episode is scoped to the token's listener: an episode id of another listener is 404. This is the cross user leak the advisory review flagged in cvzx; there is a test for it.

### Job API (all bodies from `shared/contract.ts`, invalid bodies 400 with the zod issues)

- `GET /api/jobs/due?now=<ISO instant>` (now defaults to the server clock) returns `dueResponseSchema`: active listeners whose local time at `now` is 03:00 to 05:59 on a Monday to Friday, with no episode for that local date. `date` is the listener's local date. `recent` is their last 15 episodes, `feedback` their last 10 non-empty feedback notes. Pure function for the due rule, unit tested across time zones and DST.
- `POST /api/jobs/upload` (`uploadRequestSchema`) returns `{ pathname: episodes/<listenerId>/<date>.mp3, clientToken }`: a Blob client token for the private store (random suffix, `audio/mpeg` only, `MAX_AUDIO_BYTES`, 15 minutes). Port from cvzx `src/lib/podcast/blob.ts`. 503 without `BLOB_READ_WRITE_TOKEN`.
- `POST /api/jobs/episodes` (`episodeRequestSchema`): `audioUrl` must be https on host exactly `<storeId>.private.blob.vercel-storage.com` with path under `/episodes/<listenerId>/`, no query, no `%` (port `isBlobUrl` and `blobStoreId` from cvzx `src/lib/podcast/rules.ts`). Upserts on (listener, date), deletes the replaced blob when the url changed, records a `job_runs` ok row. Returns `{ id, replaced }`.
- `POST /api/jobs/failures` (`failureRequestSchema`): records a `job_runs` fail row.

### Feed and audio

- `GET /api/feed/<token>`: RSS 2.0 with itunes and podcast namespaces, title "Diffcast for <listener name>", `itunes:block` Yes, `podcast:locked` yes, cover art `public/cover.png` (1400 square; generate a simple typographic one), last 30 episodes. Each item: guid with an audio version hash (rerun with new audio is a new item), pubDate 06:00 local on the episode date, description = summary plus segment headings, each with its source titles and urls as plain text, enclosure `<origin>/api/audio/<token>/<id>.mp3`, `itunes:duration`. Everything XML escaped. `private, max-age=300`. Records fetch stats on the token (at most once a minute). Port `buildFeed`, `xmlEscape` and `feed-tokens.ts` from cvzx and adapt.
- `GET|HEAD /api/audio/<token>/<id>.mp3`: scoped lookup, records a download for GET, 302 to a signed private Blob URL valid 10 minutes (`no-store`, `Referrer-Policy: no-referrer`). No response ever carries the raw Blob URL.

### Listener page `/l/<token>`

No login; the token is the key. Shows the listener's episodes newest first: title, date, summary, segments with sources (links), an audio player through the audio route, and a small feedback form per episode (listened yes, partly, no; useful up or down; note). One survey card at the top: "Would you pay $15 a month for this?" yes, maybe, no, plus a note, showing their current answer. A line with the feed URL and how to add it in Apple Podcasts and Overcast. `noindex`. Plain, readable, mobile first.

### Admin (`/admin`)

- Listeners: table (name, timezone, deps count, active, episodes, last episode, last feed fetch). Add and edit form: name, email, timezone (select of common zones plus free entry), minutes, focus, and a stack box that accepts a pasted `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile` or one package per line; parsed server side into `dependencySchema` entries (pure parser, unit tested per format; dedupe; dev dependencies included). Preview of the parsed list before save. Deactivate. Issue feed token (label) shows the feed URL and the listener page URL once with copy buttons; revoke.
- Episodes: filter by listener; detail page with player, summary, metrics (tokens, searches, fetches, characters, cost), segments with sources and a spot check control per segment (correct, error, unclear, note), the transcript, downloads and feedback.
- Gate (`/admin` home): the Phase 0 gate over a window (start date and weekday count from env `DIFFCAST_GATE_START` and `DIFFCAST_GATE_DAYS`, default 10): per listener delivered episodes of expected, episodes downloaded, episodes self reported listened (yes or partly), days with storyCount at least 3, would pay; totals against each gate line (5 of 8 listen to 6+, 3+ would pay, 3+ stories on 8 of 10 days per listener, at most 1 error per 20 checked segments), plus average and max cost per episode and on time rate (episode created before 06:00 local). Pure functions for every metric, unit tested.
- Runs: last 50 `job_runs`, failures highlighted.

### Checks

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass. Tests for: due rule, stack parsers, gate metrics, blob url check, feed XML, token hashing, every job route auth case, the cross listener audio 404, revoked token 404, listener page feedback actions rejecting another listener's episode. Mock the db and Blob in route tests as cvzx does (`~/Development/cvzx/src/app/api/podcast/routes.test.ts`).

## Generator (`tools/generator/`)

Own `package.json` (Node 22, ESM, TypeScript run through Node type stripping, `tsc --noEmit` for checks, vitest), dependencies `@anthropic-ai/sdk`, `@vercel/blob`, `zod`. Imports `../../shared/contract.ts`. Runs hourly on fw13 (systemd timer); each run handles every listener returned by `/api/jobs/due`, one at a time, and exits non-zero if any failed. A lock file stops overlapping runs (port from cvzx `tools/podcast/run.mjs`).

Per listener:

1. Research and write: one Anthropic Messages API call loop through Vercel AI Gateway (`AI_GATEWAY_API_KEY`, base URL `https://ai-gateway.vercel.sh`, model `DIFFCAST_MODEL` default `anthropic/claude-sonnet-5-5`) with the server side `web_search` and `web_fetch` tools (capped uses), and the prompt in `tools/generator/prompt.md`. Read the `claude-api` skill before writing this code for current tool versions, pricing and model ids. The listener brief rides in the user message. The reply is the episode JSON only; parse it and validate with `episodeScriptSchema` plus show rules: every segment has a source; word count within the range for `minutes` (`WORDS_PER_MINUTE`; the lower bound scales down when `storyCount` is low, never padded: 3+ stories target the full length, 1 to 2 stories about half, 0 stories a 90 second "quiet day" episode); no turn over 180 words; em and en dashes in turns become commas. On failure, retry once with the problems appended, then report failure.
2. Voice: ElevenLabs per turn (`ELEVENLABS_API_KEY`, `DIFFCAST_HOST_VOICE`, `DIFFCAST_COHOST_VOICE`, `DIFFCAST_TTS_MODEL` default `eleven_v4`) with `previous_text` and `next_text`, clip cache keyed by voice, model and text hash, retry policy from cvzx (`tools/podcast/run.mjs` `tts`). Count characters.
3. Mix: ffmpeg concat with 0.3 s gaps between speakers and 0.15 s within a speaker, loudnorm to -16 LUFS, mp3 (port `stepMix`). ffprobe for duration.
4. Upload: `POST /api/jobs/upload`, then `put(pathname, file, { access: 'private', token: clientToken })`.
5. Save: `POST /api/jobs/episodes` with metrics: tokens and searches from the API usage, cost from the current price table in one place (`pricing.ts`, values from the claude-api skill and ElevenLabs list price via `DIFFCAST_TTS_USD_PER_1K_CHARS`).

Any step failing posts `/api/jobs/failures` and moves to the next listener. Work dir `DIFFCAST_WORK_DIR` (default `~/diffcast-work`) keeps `<listenerId>/<date>/` files (brief, raw reply, episode.json, clips, mix) for 14 days. Flags: `--listener <id>`, `--date`, `--from-step research|tts|mix|upload|save` (resume from saved files), `--dry-run` (fixture episode, silent clips, real mix, no API calls), `--no-upload`, `--now <ISO>` passed to `/api/jobs/due`. Env `DIFFCAST_URL`, `DIFFCAST_JOB_TOKEN`.

The research loop never gets local tools, files or shell; secrets other than the Anthropic key never enter the prompt.

### Prompt (`tools/generator/prompt.md`)

A daily tech and AI briefing for one developer, built on the cvzx `tools/podcast/prompt.md`: primary sources, fetch before relying, never invent quotes, numbers or dates, say when unconfirmed, challenge not affirmation, the "write for the ear" block and the JSON only output contract. Diffcast specifics:

- Window: the last 24 hours; a Monday episode covers the weekend. The brief allows "since the last episode" only when `recent` is non empty. Older items only as `update` segments on stories in `recent`, when something materially changed.
- Choose for consequence to this listener across their interests, at most one story per interest, spread across interests. Interest notes guide what matters within a topic.
- The stack is one signal: a `stack` segment only when a real release, breaking change, deprecation or advisory touched their packages, tagged in `packages`.
- A story touching an interest with a take becomes a `challenge` segment: steelman the other side, name who holds it, expand the debate, end on what would change the conclusion.
- An optional `wildcard` adjacent to their interests that connects back. Close with `watch` when something is coming.
- Never pad. Set `storyCount` honestly (wildcard excluded). Validation does not require a challenge or wildcard; they depend on the day.
- Privacy: the focus text and notes may name employers, clients or private projects. Never say or write those names.
- Two hosts: Mara (host) leads and explains; Theo (cohost) is the practical engineer who asks what it means for their work and pushes on hype. No flattery, no "great question", no welcome boilerplate.

### Tests and checks

`pnpm --dir tools/generator test` and `typecheck` pass. Unit tests for validation and word ranges, reply parsing (code fence tolerated), cost math, the due loop's failure isolation (mocked API), and a dry-run end to end that produces an mp3 with ffmpeg if available.

## Deploy (after both parts)

Neon database and private Blob store connected to the Vercel project, env vars set, migration applied, a NixOS service and hourly timer on fw13 (`~/.config/nixos/server.nix`, pattern in cvzx `tools/podcast/README.md`) running from a checkout at `~/diffcast` with secrets in `/etc/diffcast/env`. README in `tools/generator/` with setup and the NixOS snippet.
