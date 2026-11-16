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

## License

MIT
