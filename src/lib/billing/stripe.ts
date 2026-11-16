import Stripe from 'stripe'

export const PROJECT_METADATA = { project: 'diffcast' } as const

let client: Stripe | null = null

function requiredEnv(name: string): string {
	const value = process.env[name]
	if (!value) throw new Error(`${name} is not set`)
	return value
}

export function stripe(): Stripe {
	if (!client) client = new Stripe(requiredEnv('STRIPE_SECRET_KEY'))
	return client
}

export function priceId(): string {
	return requiredEnv('STRIPE_PRICE_ID')
}

export function webhookSecret(): string {
	return requiredEnv('STRIPE_WEBHOOK_SECRET')
}

export function portalConfigurationId(): string {
	return requiredEnv('STRIPE_PORTAL_CONFIGURATION_ID')
}

export function customerDashboardUrl(customerId: string, secretKey: string): string {
	const test = secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_')
	return `https://dashboard.stripe.com/${test ? 'test/' : ''}customers/${customerId}`
}
