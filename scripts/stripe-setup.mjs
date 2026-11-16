import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(path.join(root, file))
	} catch {}
}

const LOOKUP_KEY = 'diffcast_standard_monthly'
const PRODUCT_NAME = 'Diffcast Standard'
const METADATA = { project: 'diffcast' }
const SITE = process.env.DIFFCAST_SITE_URL || 'https://diffcast.fm'
const WEBHOOK_URL = `${SITE}/api/stripe/webhook`
const WEBHOOK_EVENTS = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'invoice.paid',
]

const outFlag = process.argv.indexOf('--out')
const outFile = outFlag === -1 ? null : process.argv[outFlag + 1]
if (outFlag !== -1 && !outFile) throw new Error('--out needs a file path')

const key = process.env.STRIPE_SECRET_KEY
if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test'
const stripe = new Stripe(key)

async function findOrCreatePrice() {
	const existing = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], expand: ['data.product'] })
	const found = existing.data[0]
	if (found) {
		const product = typeof found.product === 'string' ? found.product : found.product.id
		return { priceId: found.id, productId: product, created: false }
	}
	let product = null
	for await (const candidate of stripe.products.list({ active: true, limit: 100 })) {
		if (candidate.metadata.project === METADATA.project && candidate.name === PRODUCT_NAME) {
			product = candidate
			break
		}
	}
	product ??= await stripe.products.create({
		name: PRODUCT_NAME,
		description: 'A private daily tech and AI news podcast, about ten minutes each morning.',
		metadata: METADATA,
	})
	const price = await stripe.prices.create({
		product: product.id,
		currency: 'usd',
		unit_amount: 2500,
		recurring: { interval: 'month' },
		lookup_key: LOOKUP_KEY,
		nickname: 'Standard monthly',
		metadata: METADATA,
	})
	return { priceId: price.id, productId: product.id, created: true }
}

async function findOrCreatePortal() {
	const features = {
		subscription_cancel: {
			enabled: true,
			mode: 'at_period_end',
			cancellation_reason: {
				enabled: true,
				options: ['too_expensive', 'missing_features', 'unused', 'low_quality', 'other'],
			},
		},
		payment_method_update: { enabled: true },
		invoice_history: { enabled: true },
		customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
		subscription_update: { enabled: false },
	}
	const settings = {
		business_profile: {
			headline: 'Manage your Diffcast subscription',
			privacy_policy_url: `${SITE}/privacy`,
			terms_of_service_url: `${SITE}/terms`,
		},
		default_return_url: `${SITE}/account`,
		features,
		metadata: METADATA,
	}
	for await (const configuration of stripe.billingPortal.configurations.list({ limit: 100 })) {
		if (configuration.metadata?.project === METADATA.project && configuration.active) {
			await stripe.billingPortal.configurations.update(configuration.id, settings)
			return { portalId: configuration.id, created: false }
		}
	}
	const created = await stripe.billingPortal.configurations.create(settings)
	return { portalId: created.id, created: true }
}

async function findOrCreateWebhook() {
	for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
		if (endpoint.url === WEBHOOK_URL) {
			await stripe.webhookEndpoints.update(endpoint.id, {
				enabled_events: WEBHOOK_EVENTS,
				metadata: METADATA,
			})
			return { webhookId: endpoint.id, webhookSecret: null, created: false }
		}
	}
	const endpoint = await stripe.webhookEndpoints.create({
		url: WEBHOOK_URL,
		enabled_events: WEBHOOK_EVENTS,
		description: 'Diffcast subscriptions',
		metadata: METADATA,
	})
	return { webhookId: endpoint.id, webhookSecret: endpoint.secret ?? null, created: true }
}

const price = await findOrCreatePrice()
const portal = await findOrCreatePortal()
const webhook = await findOrCreateWebhook()

const result = {
	mode,
	productId: price.productId,
	priceId: price.priceId,
	portalId: portal.portalId,
	webhookId: webhook.webhookId,
	webhookSecret: webhook.webhookSecret,
}
console.warn(
	`${mode}: product ${price.productId}, price ${price.priceId} (${price.created ? 'created' : 'exists'}), ` +
		`portal ${portal.portalId} (${portal.created ? 'created' : 'updated'}), ` +
		`webhook ${webhook.webhookId} (${webhook.created ? 'created, secret written' : 'updated, secret unchanged'})`
)
if (outFile) await writeFile(outFile, JSON.stringify(result, null, '\t'), { mode: 0o600 })
else if (webhook.webhookSecret) {
	console.warn('Pass --out <file> to capture the new webhook secret; it is not printed.')
}
