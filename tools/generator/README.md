# Diffcast generator

Runs hourly on the home server (fw13). Asks the web app which listeners are due (`/api/jobs/due`), and for each one: researches the day with a tool loop (prompt in `research-prompt.md`), writes a two host episode from the research notes (prompt in `writer-prompt.md`), voices it, mixes it with ffmpeg, uploads it to the private Blob store and saves it through the job API. Every model call goes through Vercel AI Gateway with the AI SDK (`ai`), and every model is set by env. Request and response bodies come from `shared/contract.ts`; nothing is copied.

The generator has its own `pnpm-lock.yaml`; pnpm finds the root `pnpm-workspace.yaml` from here, so every install in this folder passes `--ignore-workspace` (without it pnpm writes into the root lockfile and installs nothing here). Plain TypeScript run by Node's type stripping (`node --experimental-strip-types src/main.ts`, needed on Node 22.16). `shared/contract.ts` imports `zod` from the root `node_modules`, so the root install is required too.

## One-time setup

```sh
pnpm install --frozen-lockfile                   # repo root: provides zod for shared/contract.ts
pnpm --dir tools/generator install --frozen-lockfile --ignore-workspace
```

Needs on PATH: Node 22.16 or later, ffmpeg and ffprobe.

## Environment

| Variable                  | Meaning                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIFFCAST_URL`            | Web app origin, for example `https://diffcast-fm.vercel.app`. Required.                                                                         |
| `DIFFCAST_JOB_TOKEN`      | Bearer token for `/api/jobs/*` (at least 32 characters). Required.                                                                              |
| `AI_GATEWAY_API_KEY`      | Vercel AI Gateway key (personal team). Pays for research, writing, search and voice. Required.                                                  |
| `DIFFCAST_RESEARCH_MODEL` | Gateway model id for the research loop. Default `google/gemini-3.8-flash`.                                                                      |
| `DIFFCAST_WRITER_MODEL`   | Gateway model id for the writing call. Default `anthropic/claude-sonnet-5-5` (Gemini Flash broke the ear and challenge rules).                  |
| `DIFFCAST_TTS_MODEL`      | Gateway speech model id. Default `elevenlabs/eleven-v4-turbo`.                                                                                  |
| `DIFFCAST_HOST_VOICE`     | Voice id for Mara (host) on the speech model. Default `XrExE9yKIg1WjnnlVkGX` (the ElevenLabs premade voice the cvzx podcast used for its host). |
| `DIFFCAST_COHOST_VOICE`   | Voice id for Theo (cohost). Default `iP95p4xoKVk53GoZ742B` (the cvzx podcast's cohost premade voice). Never a Monogram voice.                   |
| `DIFFCAST_WORK_DIR`       | Work files go to `<dir>/<listenerId>/<date>/`. Default `~/diffcast-work`, outside the fw13 checkout.                                            |

Voice ids belong to the speech model: changing `DIFFCAST_TTS_MODEL` to another provider needs that provider's voice ids too.

`--dry-run` needs none of them; `--smoke` needs only `DIFFCAST_URL` and `DIFFCAST_JOB_TOKEN`.

## Commands

```sh
node --env-file=/etc/diffcast/env --experimental-strip-types src/main.ts   # hourly run
pnpm dry-run                                                                # offline: fixture due list and episode, silent clips, real mix
pnpm test
pnpm typecheck
```

Flags:

- `--dry-run`: no network at all. The due list is `fixtures/due.json` (one listener per format: a Monday daily, a Saturday weekly recap, a Sunday week ahead), the episode is `fixtures/episode.json`, clips are silence of about the spoken length, the mix is real. Stops after the mix.
- `--smoke`: end to end test of the deployed app without paid APIs. The episode is `fixtures/episode.json` and clips are silence (no gateway calls), but the due list, upload and save are real against `DIFFCAST_URL`, with `--now` and `--listener` honored. Metrics are zeroed with model `smoke`. It publishes a real (silent) episode for that listener and date, replacing any episode already there, so point it at a test listener: `node --env-file=/etc/diffcast/env --experimental-strip-types src/main.ts --smoke --listener <id> --now <instant in their 03:00 to 05:59 window>`. Not combinable with `--dry-run` or `--no-upload`.
- `--no-upload`: real research, writing and voice, stop after the mix.
- `--now <ISO instant>`: passed to `/api/jobs/due` to see who is due at another time (for reruns of a missed hour).
- `--listener <id>`: only that listener from the due list; it is an error if they are not due.
- `--date YYYY-MM-DD` (with `--listener`): overrides the episode date.
- `--from-step research|write|tts|mix|upload|save` (with `--listener` and `--date`): resume from files in the work dir; the brief is read from the saved `brief.json`, not fetched. `research` researches and writes again from the saved brief; `write` rewrites the episode from the saved `research-notes.json` (cheap, no searching); `tts` and `mix` reuse cached clips; `upload` uploads the saved mix; `save` re-saves with the url in `upload.json`.

Work dir per episode: `brief.json`, `research-notes.json` (stories plus every page fetched), `research.json` (model, tokens, cost, searches, fetches, research time), `reply-1.json` and `reply-2.json` (raw writer replies), `episode.json`, `write.json` (model, tokens, cost, attempts), `clips/NNN-<speaker>-<hash>.mp3` with `clips/costs.json` (billed cost per clip), `tts.json`, `episode.mp3`, `upload.json`. Episode dirs older than 14 days are removed after each run. `<work>/.lock` holds the pid of the running job; a second run exits 1 while that pid is alive, and a stale lock is replaced.

## How a run works

Listeners run one at a time. A failing step posts `/api/jobs/failures` with the step (`research`, `validate`, `tts`, `mix`, `upload`, `save`; a writing call that errors reports as `research`) and the run moves to the next listener; the process exits 1 if any listener failed.

Research: one `generateText` tool loop on `DIFFCAST_RESEARCH_MODEL` with two tools and no files or shell. `parallel_search` is the gateway's Parallel Search (8 results, excerpts of at most 1,200 characters, `sourcePolicy.afterDate` set to the start of the window: the listener's last episode date (`since` in the due list), or yesterday for a first episode, never more than 8 days back). `fetch_page` (`src/fetch-page.ts`) is local: plain `fetch` with a 20 s timeout, a 2 MB cap, at most 5 redirects, http(s) only, and every hop refused if the host is or resolves to a loopback, private, link local or CGNAT address; Readability over linkedom reduces the HTML to text cut to 6,000 characters. Caps per format (`RESEARCH_LIMITS` in `src/research.ts`): daily 12 searches, 15 fetches and 32 steps; weekly recap 10, 12 and 26; week ahead 5, 6 and 14. The budget opens the user message (`prepareStep` drops a tool at its cap and all tools on the last step, and the fetch tool refuses past its cap). The loop ends in structured notes (`src/research-notes.ts`): stories with headline, what happened, why it matters, dates, interests, packages, suggested kind, quoted take and sources. Sources the model did not actually fetch are removed, and a story left with none is dropped. The listener brief rides in the user message.

Work context: the due list carries `workContext`, what the listener's coding agent pushed through the Diffcast MCP server (project, packages, topics, a one line summary; at most 10, newest first). `src/work-context.ts` turns it into the strongest signal in the brief: projects become `private project N`, their names are redacted from summaries, and their packages join the stack for that episode (`npm:`, `pypi:`, `cargo:`, `go:` and `rubygems:` prefixes set the ecosystem, otherwise `other`). `checkScript` rejects a script that names a project in its title, summary, headings, challenges or turns (whole word, case insensitive), so the writer retries with the problem listed.

Concurrency: `DIFFCAST_CONCURRENCY` listeners are produced at once (default 3, 1 to 32); a failure stays with its listener.

Formats: the due list gives each listener a `format`. `daily` on weekdays is the daily news. `weekly_recap` on Saturday recaps the listener's week: the researcher starts from this week's stories in `recent`, fetches their sources again and adds what is new. `week_ahead` on Sunday is a short look at the coming seven days (releases, deprecations, events, decisions), mostly `watch` segments. Both prompts carry the rules for each format, and the brief says which one applies.

Writing: one `generateText` call on `DIFFCAST_WRITER_MODEL` with only the brief and the notes (no tools) and structured output shaped by `episodeScriptSchema`. Gemini refuses schemas with many length and count bounds, so the model sees the JSON schema without them (`src/model-schema.ts`) and the reply is validated in code against the full zod schema plus the show rules: every cited url must be in the notes, no turn over 180 words, em and en dashes in turns become commas, and the total word count fits the story count:

| `storyCount` | Words (at 150 per minute of `minutes`; the week ahead uses at most 4 minutes) |
| ------------ | ----------------------------------------------------------------------------- |
| 3 or more    | 80% to 115% of full length                                                    |
| 1 or 2       | 40% to 115% of full length (target about half)                                |
| 0            | 135 to 338 (a 90 second quiet day)                                            |

An invalid reply gets one retry of the writing call with the problems listed, then the listener fails at `validate`. Research is not repeated.

Voice: one `generateSpeech` call per turn through the gateway (mp3), three at a time. Clips are cached by model, voice and text hash, so a rerun does not pay twice. Requests time out at 120 s; network errors, 429 and 5xx back off with jitter (honoring `retry-after`) for up to about 5 minutes per clip, while other 4xx fail at once with the API message.

Mix: 0.3 s gaps between speakers, 0.15 s within a speaker, loudnorm to -16 LUFS, mono 96 kbps mp3; ffprobe reads the duration.

Upload and save: `POST /api/jobs/upload` returns a pathname and a Blob client token, then `put(pathname, file, { access: 'private', token })`; the upload is retried twice with a fresh token. `POST /api/jobs/episodes` saves the episode with metrics: `model` is `<research model> + <writer model>`, tokens are research plus writing, searches and fetches are the tool calls, and costs are the billed amounts the gateway returns in `providerMetadata.gateway.cost` on every step and speech call (`llmCostUsd` is research and writing with search included, `ttsCostUsd` the clips). There is no price table. Job API calls time out at 30 s and retry network errors and 5xx 3 times.

## NixOS service and timer

In `~/.config/nixos/server.nix`, with the checkout at `~/diffcast` and secrets in `/etc/diffcast/env` (root owned, mode 0600):

```nix
{ pkgs, ... }:
{
  systemd.services.diffcast-generator = {
    description = "Diffcast episode generator";
    path = [ pkgs.nodejs_22 pkgs.pnpm pkgs.ffmpeg pkgs.coreutils pkgs.git ];
    serviceConfig = {
      Type = "oneshot";
      User = "isaach";
      WorkingDirectory = "/home/isaach/diffcast/tools/generator";
      EnvironmentFile = "/etc/diffcast/env";
      ExecStartPre = [
        "${pkgs.bash}/bin/bash -c 'cd /home/isaach/diffcast && ${pkgs.git}/bin/git pull --ff-only'"
        "${pkgs.bash}/bin/bash -c 'cd /home/isaach/diffcast && ${pkgs.pnpm}/bin/pnpm install --frozen-lockfile --prod'"
        "${pkgs.bash}/bin/bash -c 'cd /home/isaach/diffcast/tools/generator && ${pkgs.pnpm}/bin/pnpm install --frozen-lockfile --prod --ignore-workspace'"
      ];
      ExecStart = "${pkgs.nodejs_22}/bin/node --experimental-strip-types src/main.ts";
      TimeoutStartSec = "55min";
    };
  };

  systemd.timers.diffcast-generator = {
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "*-*-* *:05:00";
      Persistent = true;
    };
  };
}
```

`EnvironmentFile` is read by systemd as root before the service drops to the user, so the 0600 root owned file works. The due window is 03:00 to 05:59 local, so an hourly timer gives each listener three chances before 06:00. Check runs with `journalctl -u diffcast-generator`.
