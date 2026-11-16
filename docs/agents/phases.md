# Phases and gates

Working plan to a paid launch in about 10 weeks part-time, from the Fable advisory review of 2026-11-16 (`docs/agents/advisory-2026-11-16.md`). Each gate is go/no-go: if it fails, fix that phase before moving on.

| Phase       | Weeks  | Build                                                                                                                                                                       | Gate                                                                                                                                                                                                   |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 Prototype | 1 to 2 | No pipeline. Fork the cvzx fw13 generator (`cvzx/tools/podcast`) with a dev prompt and a pasted package.json, for Isaac plus 6 to 8 developers, 10 weekdays, private feeds. | 5 of 8 play 6+ episodes; 3+ say they would pay $15; 3+ real stories on 8 of 10 days per listener; at most 1 factual error in 20 spot-checked segments. Short on stories: drop to three a week or stop. |
| 1 Pipeline  | 3 to 5 | Shared brief cache keyed by repo and tag, per-user script, TTS, Blob, feed, on Vercel Workflow with AI SDK and AI Gateway.                                                  | 10 unattended days, 95%+ delivered by 6am, measured cost at most $0.35 per episode, rated no worse than phase 0.                                                                                       |
| 2 MCP       | 6 to 7 | Sign-in, OAuth (an auth provider that is also an authorization server), `push_context`, `get_latest_episode`, segment thumbs.                                               | Half the cohort connects and pushes weekly unprompted, or MCP is a feature, not the wedge.                                                                                                             |
| 3 Paid      | 8 to 9 | Stripe, trial cap, export and delete, landing page with samples.                                                                                                            | 5+ cohort members pay; a deletion test purges rows, blobs and workflow run data.                                                                                                                       |
| 4 Launch    | 10     | Public launch.                                                                                                                                                              | 25 paid at day 30, week 4 retention 60%+.                                                                                                                                                              |

## Scope

- Now: Neon Postgres with plain SQL migrations (the cvzx pattern), a private Blob store, zod, the feed, audio and upload routes ported from cvzx with a `user_id`.
- Only when needed: pgvector (once HN and blog sources arrive; releases and package names match exactly).
- Not unless measured: Vercel Queues, Redis, BotID.
- Cut from launch: GitHub connect, the recap worksheet, `ask_about_episode`, per-project weighting, on-demand episodes.
