# Diffcast generator

Runs hourly on the home server (fw13). Asks the web app which listeners are due (`/api/jobs/due`), and for each one: researches and writes a two host episode with the Anthropic Messages API (server side `web_search` and `web_fetch` only, prompt in `prompt.md`), voices it with ElevenLabs, mixes it with ffmpeg, uploads it to the private Blob store and saves it through the job API. Request and response bodies come from `shared/contract.ts`; nothing is copied.

The generator has its own `pnpm-lock.yaml`; pnpm finds the root `pnpm-workspace.yaml` from here, so every install in this folder passes `--ignore-workspace` (without it pnpm writes into the root lockfile and installs nothing here). Plain TypeScript run by Node's type stripping (`node --experimental-strip-types src/main.ts`, needed on Node 22.16). `shared/contract.ts` imports `zod` from the root `node_modules`, so the root install is required too.

## One-time setup

```sh
pnpm install --frozen-lockfile                   # repo root: provides zod for shared/contract.ts
pnpm --dir tools/generator install --frozen-lockfile --ignore-workspace
```

Needs on PATH: Node 22.16 or later, ffmpeg and ffprobe.

## Environment

| Variable                        | Meaning                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DIFFCAST_URL`                  | Web app origin, for example `https://diffcast-fm.vercel.app`. Required.                                                   |
| `DIFFCAST_JOB_TOKEN`            | Bearer token for `/api/jobs/*` (at least 32 characters). Required.                                                        |
| `ANTHROPIC_API_KEY`             | Anthropic key. The only secret the research step sees. Required.                                                          |
| `DIFFCAST_MODEL`                | Model id. Default `claude-sonnet-5-5`. Must have a row in `src/pricing.ts`.                                               |
| `ELEVENLABS_API_KEY`            | ElevenLabs key. Required.                                                                                                 |
| `DIFFCAST_HOST_VOICE`           | ElevenLabs voice id for Mara (host). Required.                                                                            |
| `DIFFCAST_COHOST_VOICE`         | ElevenLabs voice id for Theo (cohost). Required. Pick two premade voices with contrasting timbre. Never a Monogram voice. |
| `DIFFCAST_TTS_MODEL`            | ElevenLabs model id. Default `eleven_v4`.                                                                                 |
| `DIFFCAST_TTS_USD_PER_1K_CHARS` | ElevenLabs list price per 1,000 characters on the current plan, for the cost metric. Required.                            |
| `DIFFCAST_WORK_DIR`             | Work files go to `<dir>/<listenerId>/<date>/`. Default `~/diffcast-work`, outside the fw13 checkout.                      |

`--dry-run` needs none of them.

## Commands

```sh
node --env-file=/etc/diffcast/env --experimental-strip-types src/main.ts   # hourly run
pnpm dry-run                                                                # offline: fixture due list and episode, silent clips, real mix
pnpm test
pnpm typecheck
```

Flags:

- `--dry-run`: no network at all. The due list is `fixtures/due.json`, the episode is `fixtures/episode.json`, clips are silence of about the spoken length, the mix is real. Stops after the mix.
- `--no-upload`: real research and voice, stop after the mix.
- `--now <ISO instant>`: passed to `/api/jobs/due` to see who is due at another time (for reruns of a missed hour).
- `--listener <id>`: only that listener from the due list; it is an error if they are not due.
- `--date YYYY-MM-DD` (with `--listener`): overrides the episode date.
- `--from-step research|tts|mix|upload|save` (with `--listener` and `--date`): resume from files in the work dir; the brief is read from the saved `brief.json`, not fetched. `research` rewrites the episode from the saved brief; `tts` and `mix` reuse cached clips; `upload` uploads the saved mix; `save` re-saves with the url in `upload.json`.

Work dir per episode: `brief.json`, `reply-1.txt` and `reply-2.txt` (raw model replies), `research.json` (usage per request, research time), `episode.json`, `clips/NNN-<speaker>-<hash>.mp3`, `episode.mp3`, `upload.json`. Episode dirs older than 14 days are removed after each run. `<work>/.lock` holds the pid of the running job; a second run exits 1 while that pid is alive, and a stale lock is replaced.

## How a run works

Listeners run one at a time. A failing step posts `/api/jobs/failures` with the step (`research`, `validate`, `tts`, `mix`, `upload`, `save`) and the run moves to the next listener; the process exits 1 if any listener failed.

Research: one streamed Messages conversation with `web_search_20260209` (at most 15 uses) and `web_fetch_20260209` (at most 25 uses) and no other tools, no files and no shell. `pause_turn` is resumed by resending the conversation, up to 8 times. Server side refusal fallbacks are on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), so a request may be served by another model; each request is priced by the model that served it. The listener brief rides in the user message; the reply is the episode JSON only (a code fence is tolerated). Validation is `episodeScriptSchema` plus show rules: no turn over 180 words, em and en dashes in turns become commas, and the total word count fits the story count:

| `storyCount` | Words (at 150 per minute of `minutes`)         |
| ------------ | ---------------------------------------------- |
| 3 or more    | 80% to 115% of full length                     |
| 1 or 2       | 40% to 115% of full length (target about half) |
| 0            | 135 to 338 (a 90 second quiet day)             |

An invalid reply gets one retry in the same conversation with the problems listed, then the listener fails at `validate`.

Voice: one ElevenLabs request per turn with `previous_text` and `next_text`, three at a time. Clips are cached by voice, model and text hash, so a rerun does not pay twice. Requests time out at 120 s; network errors, 429 and 5xx back off with jitter (honoring `retry-after`) for up to about 5 minutes per clip, while other 4xx fail at once with the API message.

Mix: 0.3 s gaps between speakers, 0.15 s within a speaker, loudnorm to -16 LUFS, mono 96 kbps mp3; ffprobe reads the duration.

Upload and save: `POST /api/jobs/upload` returns a pathname and a Blob client token, then `put(pathname, file, { access: 'private', token })`; the upload is retried twice with a fresh token. `POST /api/jobs/episodes` saves the episode with metrics: tokens (input includes cache reads and writes), web searches and fetches from the API usage, TTS characters, and costs from `src/pricing.ts` (model prices and the $10 per 1,000 web searches; web fetch is free) and `DIFFCAST_TTS_USD_PER_1K_CHARS`. Job API calls time out at 30 s and retry network errors and 5xx 3 times.

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
