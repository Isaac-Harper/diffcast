# Dev Podcast Service: Product Proposal

Nov 15, 2026 · Isaac Harper

## Summary

A paid daily audio briefing for developers: real news on the stack they actually use, voiced as a two-host podcast, with an optional recap worksheet that feeds back into tomorrow's episode. It spins out of the podcast feature in cvzx.

The wedge is the developer niche plus agent integration. A remote MCP server lets a user's coding agent (Claude Code, Cursor, Claude) push what they're working on, so interests stay current without manual curation, and recaps flow back into the agent's context.

Target: individual developers at $15/month, with a $30 tier for premium voices and longer episodes. Everything runs on Vercel.

## Problem and positioning

General personalized news podcasts are a crowded commodity; nobody owns the developer niche with agent integration and a learning loop. Developers track fast-moving tooling (framework releases, model launches, deprecations, security advisories) across changelogs, GitHub, HN, and X. Reading all of it is a part-time job.

| Product         | What it does                              | Gap we exploit                                |
| --------------- | ----------------------------------------- | --------------------------------------------- |
| Podio           | Daily AI news channel from your interests | General audience, weak on source transparency |
| ArticleCast     | Interest-based daily or weekly podcast    | No dev focus, no retention loop               |
| NewsTune        | Personalized podcast with an MCP server   | MCP is a remote control, not context sync     |
| Washington Post | AI podcast from WaPo articles only        | Single publisher, general news                |
| Huxe            | Briefings from email, calendar, interests | Shut down May 2026; Apple took options on IP  |

Differentiators:

1. Dev-native sources. Changelogs, release notes, GitHub releases, advisories, and vendor blogs, not general news wires.
2. Two-way MCP. The user's agent pushes current work context in and reads recaps back out.
3. Retention loop. The worksheet records what stuck; the next episode revisits gaps and skips what you already know.
4. Cited segments. Every segment links its sources in the show notes.

## Product

One episode per weekday, ready by 6am in the user's time zone, delivered as a private RSS feed that works in any podcast app.

### Episode format (10 minutes default)

1. Cold open: the one story that matters most to you today.
2. Three to five segments on your stack, two hosts, each segment cited.
3. "Since last time": updates on developing stories you've already heard.
4. Close: what to watch this week (releases, deprecations, events).

### Interests

- Onboarding: paste a package.json, connect GitHub, or pick from a stack list. Repos and dependencies become weighted interests.
- MCP sync: the user's agent calls `push_context` with what they're working on; weights decay over time so stale projects fade out.
- Feedback: thumbs per segment, "more of this" and "skip this topic."

### Multiple projects

Interests are scoped to projects, so a dev juggling several client repos gets one episode covering all of them.

- A project = a key (repo remote or a user alias like `client-a`), its dependencies, and topics. The agent's `push_context` call carries the key, so each repo updates its own project.
- Each project has an activity weight that rises when its context is pushed and decays when idle. The episode splits segments across projects by weight, and paused or archived projects drop out.
- Shared dependencies are deduped: a Next.js release used by three projects is one segment, tagged with all three.
- Show notes group segments by project. Pro adds an optional short per-project episode on demand.

### Recap worksheet (optional)

Five to eight questions per episode, mixing recall and "how would this affect your project" prompts. Answers update a per-topic familiarity score. Low scores get a short revisit later; high scores let the script skip background. A weekly digest summarizes what you learned.

### MCP server tools

| Tool                              | Direction        | Purpose                                                   |
| --------------------------------- | ---------------- | --------------------------------------------------------- |
| `push_context`                    | agent to service | Send a project key plus its deps or topics, with a weight |
| `list_interests` / `set_interest` | both             | Read and edit interest weights                            |
| `get_latest_episode`              | service to agent | Transcript, sources, and audio URL                        |
| `get_recap`                       | service to agent | What the user learned and scored, for agent memory        |
| `ask_about_episode`               | service to agent | Answer a follow-up grounded in that episode's sources     |

Auth is OAuth so the server works as a remote connector in Claude, Cursor, and Claude Code.

## Architecture on Vercel

One Next.js app on Vercel with two durable workflows: a shared story pipeline that runs per story, and a personal episode pipeline that runs per user. Research cost scales with stories; only scripting, voice, and the worksheet scale with users.

The shared lane fills a brief cache in Postgres; each user's daily run only reads briefs, scripts, and voices.

### Components

| Layer               | Vercel piece                                         | Role                                                                     |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Web app + API       | Next.js on Vercel Functions (Fluid compute)          | Onboarding, dashboard, worksheet UI, RSS feed route                      |
| Scheduling          | Vercel Cron Jobs                                     | Hourly ingest, per-timezone episode kickoff                              |
| Orchestration       | Vercel Workflow (`use workflow` / `use step`)        | Retries and resumes multi-step pipelines without babysitting             |
| Fan-out             | Vercel Queues (`@vercel/queue`)                      | One message per story to research, one per user to build                 |
| Models              | AI SDK + AI Gateway                                  | Research and scripting models, TTS (Fish, Eleven, Gemini) behind one key |
| Database            | Postgres from the Marketplace (Neon) with pgvector   | Users, interests, stories, briefs, episodes, scores                      |
| Cache / rate limits | Upstash Redis from the Marketplace                   | Feed dedupe, per-user limits, hot story lookups                          |
| Audio + assets      | Vercel Blob                                          | MP3s, show notes, transcripts                                            |
| MCP server          | Route handler using the `mcp-handler` package, OAuth | Agent tools listed in Product                                            |
| Billing             | Stripe                                               | $15 and $30 plans, usage caps                                            |
| Protection          | Vercel Firewall + BotID                              | Keep signup and MCP endpoints clean                                      |

### Shared story pipeline (hourly)

1. Cron pulls sources: GitHub releases for tracked repos, vendor changelogs and blogs (RSS), security advisories, HN front page.
2. Embed each item and cluster into stories by similarity. A new cluster or a significant new item enqueues `research-story`.
3. Workflow `researchStory`: fetch the linked pages, write a brief (facts, newcomer and expert context, citations), store it versioned with a TTL. Developing stories append an update rather than re-research.

### Personal episode pipeline (daily, per user)

1. Cron at about 4am per timezone bucket enqueues `build-episode` for each active subscriber.
2. Workflow `buildEpisode`: rank today's briefs against interest embeddings and MCP context; skip what the user has heard.
3. Script the two-host dialogue from the briefs, adjusted by familiarity scores.
4. Voice it with the plan's TTS model, stitch segments, upload to Blob, publish to the user's private RSS feed.
5. Generate the worksheet and show notes with per-segment sources.

### Core tables

| Table       | Key fields                                                                |
| ----------- | ------------------------------------------------------------------------- |
| users       | plan, timezone, feed token, episode length, retention days                |
| projects    | user, key or alias, status (active, paused, archived), activity weight    |
| interests   | project, label, embedding, weight, source (manual, repo, mcp), expires_at |
| stories     | cluster id, embedding, first_seen, last_updated                           |
| briefs      | story, version, body, citations, expires_at                               |
| episodes    | user, date, story ids, project tags, audio url, transcript, expires_at    |
| familiarity | user, topic, score, last_seen                                             |

## Cost model and pricing

At $15/month the Standard tier clears about $9 per user after variable costs; Pro at $30 clears about $13. Voice is the largest cost, so each tier is pinned to a TTS model.

Assumptions: 22 weekday episodes a month, about 900 characters of script per minute. TTS rates are live AI Gateway per-character prices. Scripting and worksheet LLM cost is an estimate to validate in the beta. Stripe at 2.9% + $0.30.

| Tier     | Price/mo | Episode | Voice model              | TTS cost | LLM (est.) | Stripe | Margin  |
| -------- | -------- | ------- | ------------------------ | -------- | ---------- | ------ | ------- |
| Standard | $15      | 10 min  | Fish S2.1 Pro            | ~$2.97   | ~$2.50     | ~$0.74 | ~$8.80  |
| Pro      | $30      | 15 min  | Eleven v3 Conversational | ~$11.88  | ~$3.50     | ~$1.17 | ~$13.45 |

Fixed costs: Vercel Pro, Postgres, Redis, and the shared story research. Story research is paid once per story regardless of user count; budget roughly $100 to $200/month at launch scale and measure it. Around 20 to 25 Standard subscribers covers fixed costs.

Pricing notes:

- Monthly only at launch. TTS and model prices move, and annual locks in a price before costs and retention are known. Revisit annual after about 3 months of real data.
- 7-day free trial with a card, capped at 5 episodes.
- Don't sell Eleven v3/v4 voices on Standard: at 10 min weekdays that is ~$15.84 in TTS alone.
- Fish Drama 3 (~$1.98/month at Standard length) is the fallback if S2.1 Pro quality is close enough.

## Risks and mitigations

The biggest risk is acquisition, not tech; the second is a confidently wrong segment.

| Risk                                               | Mitigation                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hard to reach paying devs in a crowded category    | Build in public, launch the MCP server in connector directories, demo at Vercel/Anthropic events, free sample episode per framework     |
| Hallucinated or stale facts                        | Briefs built only from fetched pages, citations per segment, TTLs on briefs, a "flag segment" button that pulls it from future episodes |
| Provider churn (OpenAI TTS shuts down Jan 6, 2027) | All models behind AI Gateway; voice model is a config value per tier                                                                    |
| Copyright                                          | Store summaries and links, never full article text; no long quotes in scripts                                                           |
| Cost creep from heavy users                        | Fixed episode length per tier, cap on on-demand episodes, cached briefs                                                                 |
| Consumer churn                                     | The familiarity loop as a reason to stay, weekly digest; annual plans only once costs are stable                                        |
| Ongoing time cost                                  | Expect weekly checks on flags and source health, plus a few migration days a year                                                       |

## Privacy and data handling

No user data is used for training anywhere in the chain, and the service keeps as little as it can for as short as it can. Devs on client work need to trust that nothing about their clients leaks.

| Area                | Rule                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What we collect     | Signals, not code: package names, topic strings, a project key. MCP tool schemas cap field length and reject code-like payloads. GitHub connect reads manifest files only (package.json, Cargo.toml, etc.), keeps dependency names, discards the file. |
| Client names        | Users can alias any project (`client-a`), so real client or repo names never have to leave their machine.                                                                                                                                              |
| LLM calls           | Every call goes through AI Gateway with `zeroDataRetention` and `disallowPromptTraining` set; a request fails rather than falls back to a non-compliant provider.                                                                                      |
| Voice (TTS)         | Scripts carry interest data, so only TTS providers with no-training and no-retention terms are allowed. Open question: confirm whether the gateway ZDR flag covers speech models, and check Fish and ElevenLabs terms. This may limit voice choice.    |
| Retention           | Context signals expire after 30 days unless re-pushed. Episodes, transcripts, and worksheet answers default to 30 days (user can pick 7 or 90). Familiarity keeps topic scores only, no answer text.                                                   |
| Logs and analytics  | Log ids, timings, and errors; never request bodies, scripts, or context. No third-party analytics on content.                                                                                                                                          |
| Deletion and export | One-click export; account deletion purges database rows and Blob files within 24 hours.                                                                                                                                                                |
| Feeds               | Private RSS behind an unguessable, rotatable token.                                                                                                                                                                                                    |
| Shared research     | Built only from public sources. No user data enters the shared brief cache.                                                                                                                                                                            |

## Roadmap

About 10 weeks part-time to a paid launch, with a go/no-go gate between each phase. Gate targets are proposals to adjust after the prototype.

If a gate fails, fix that phase before moving on; the prototype gate is the cheapest place to kill the idea.

(The phase table did not survive the paste into the repo; see `docs/agents/phases.md` for the working phase plan.)

## Name ideas

Top pick: Lockfile. It says "everything you depend on" to any developer and lockfile.fm is open. Domain checks are registry availability via Vercel; trademark and existing-podcast conflicts are not checked.

| Name            | Idea                                   | Domain open                       |
| --------------- | -------------------------------------- | --------------------------------- |
| Lockfile        | Your dependencies, briefed daily       | lockfile.fm (.dev taken)          |
| Breaking Change | News that affects your code            | breakingchange.fm                 |
| stdout          | The day's output for your stack        | stdout.fm                         |
| Diffcast        | What changed since yesterday           | diffcast.fm (.dev taken)          |
| Upstream        | News from the projects you pull from   | upstream.fm                       |
| Morning Build   | Daily build of your news               | morningbuild.fm, morningbuild.dev |
| tl;dl           | Too long; didn't listen. Wait, you did | tldl.dev (.fm taken)              |
| Patch Notes     | Release notes, read aloud              | patchnotes.fm                     |
| Semver          | Major, minor, patch news               | semver.fm                         |
| Deps Daily      | Plain and descriptive                  | depsdaily.com                     |

Taken: changelog.fm, standup.fm.
