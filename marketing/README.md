# Marketing

Launch assets. Nothing here ships with the app.

## Audiogram

`node scripts/make-audiogram.mjs <episode work dir> --out marketing/audiogram-sample.mp4 --label "Sample episode"` cuts a 1080x1080 H.264 and AAC clip (30 to 45 seconds, under 15 MB, ready for X) from a generator work dir (`episode.mp3`, `episode.json`, `clips/`). It picks the earliest stretch that starts on a turn, has both hosts and ends on a full sentence; `--start` and `--end` (seconds) override it. Captions come from the script, timed by the voice clip lengths, so no transcription runs. The sample needs the `--sample` work dir (`<DIFFCAST_WORK_DIR>/999999/<date>`), since `public/sample/` keeps no turns.

- `audiogram-sample.mp4`: not produced yet; the sample episode (DIF-9) has not been generated.
