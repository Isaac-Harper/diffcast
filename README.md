# Diffcast

A paid daily two host podcast on tech and AI news for developers, tuned to each listener's interests and stack, every segment cited. $25 a month through Stripe.

Product proposal: [docs/proposal.md](docs/proposal.md). Agent onboarding and architecture: [AGENTS.md](AGENTS.md).

## Develop

```sh
pnpm install
vercel env pull
pnpm dev
```

Every variable the app reads is in `.env.example`. Local and production share one database.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`, `pnpm build`. The episode generator in `tools/generator` has its own (see its README).

## Billing setup

`node scripts/stripe-setup.mjs --out <file>` creates or updates, idempotently, the Diffcast Standard product and its $25 monthly price (lookup key `diffcast_standard_monthly`), the billing portal configuration and the webhook endpoint at `https://diffcast.fm/api/stripe/webhook`. It uses `STRIPE_SECRET_KEY` and writes the ids (and a new endpoint's signing secret) to the file, never to the terminal.

## MCP server

Subscribers connect a coding agent to `https://diffcast.fm/api/mcp` (OAuth 2.1 with PKCE, Client ID Metadata Documents or dynamic registration). Setup for users is on `/agents`. To check a running app end to end: `node scripts/mcp-e2e-listener.mjs create <cookie-file>`, `DIFFCAST_E2E_COOKIE=$(cat <cookie-file>) node scripts/mcp-e2e.mjs <base-url>`, then `node scripts/mcp-e2e-listener.mjs delete`.

## License

MIT
