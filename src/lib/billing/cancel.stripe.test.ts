import Stripe from 'stripe'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FakeMailer } from '@/lib/email/fake-mailer'

const TEST_KEY = process.env['STRIPE_TEST_SECRET_KEY'] ?? ''
const LOCAL_WEBHOOK_SECRET = 'whsec_local_cancel_test'

const mocks = vi.hoisted(() => ({ listenerId: 0, mailer: null as unknown as FakeMailer }))

vi.mock('@/lib/db', async () => {
	const { createTestDatabase } = await import('@/test/pglite')
	return createTestDatabase()
})
vi.mock('@/lib/email/resend-mailer', () => ({ currentMailer: () => mocks.mailer }))
vi.mock('@/lib/listener-auth', () => ({ requireListener: async () => mocks.listenerId }))
vi.mock('next/cache', () => ({ refresh: () => undefined }))

async function until<T>(read: () => Promise<T | null>, what: string): Promise<T> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		const value = await read()
		if (value !== null) return value
		await new Promise((resolve) => setTimeout(resolve, 2000))
	}
	throw new Error(`Timed out waiting for ${what}`)
}

describe.skipIf(TEST_KEY === '')('cancel flow against Stripe test mode', () => {
	let client: Stripe
	let clockId = ''

	beforeAll(() => {
		if (!TEST_KEY.startsWith('sk_test_') && !TEST_KEY.startsWith('rk_test_')) {
			throw new Error('STRIPE_TEST_SECRET_KEY must be a test mode key')
		}
		vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
		vi.stubEnv('STRIPE_WEBHOOK_SECRET', LOCAL_WEBHOOK_SECRET)
		client = new Stripe(TEST_KEY)
		mocks.mailer = new FakeMailer()
	})

	afterAll(async () => {
		if (clockId) await client.testHelpers.testClocks.del(clockId)
	})

	async function deliver(type: string, subscriptionId: string, after: number): Promise<void> {
		const { POST } = await import('@/app/api/stripe/webhook/route')
		const event = await until(async () => {
			const listed = await client.events.list({ type, created: { gte: after }, limit: 100 })
			const match = listed.data.find(
				(candidate) => (candidate.data.object as { id?: string }).id === subscriptionId
			)
			return match ?? null
		}, `${type} for ${subscriptionId}`)
		const payload = JSON.stringify(event)
		const response = await POST(
			new Request('https://diffcast.fm/api/stripe/webhook', {
				method: 'POST',
				headers: {
					'stripe-signature': Stripe.webhooks.generateTestHeaderString({
						payload,
						secret: LOCAL_WEBHOOK_SECRET,
					}),
					host: 'diffcast.fm',
				},
				body: payload,
			})
		)
		expect(await response.json()).toMatchObject({ received: true, outcome: 'handled' })
	}

	it('cancels from the app, keeps the feed until the period ends, then ends service', async () => {
		const db = (await import('@/lib/db')) as unknown as {
			query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
		}
		const { cancelSubscription } = await import('@/app/account/actions')
		const { getListener, listServedListeners } = await import('@/lib/store/listeners')
		const { businessCounts } = await import('@/lib/store/business')

		const start = Math.floor(Date.now() / 1000)
		const clock = await client.testHelpers.testClocks.create({
			frozen_time: start,
			name: 'diffcast cancel flow test',
		})
		clockId = clock.id
		const customer = await client.customers.create({
			email: 'cancel-flow@example.com',
			test_clock: clock.id,
			payment_method: 'pm_card_visa',
			invoice_settings: { default_payment_method: 'pm_card_visa' },
			metadata: { project: 'diffcast' },
		})
		const prices = await client.prices.list({ lookup_keys: ['diffcast_standard_monthly'] })
		const price = prices.data[0]
		if (!price) throw new Error('Test mode has no diffcast_standard_monthly price')
		const created = await client.subscriptions.create({
			customer: customer.id,
			items: [{ price: price.id }],
			metadata: { project: 'diffcast' },
		})
		expect(created.status).toBe('active')

		const inserted = await db.query(
			`INSERT INTO listeners (name, email, timezone, stripe_customer_id, stripe_subscription_id)
			VALUES ('Cancel', 'cancel-flow@example.com', 'UTC', $1, $2) RETURNING id`,
			[customer.id, created.id]
		)
		mocks.listenerId = inserted[0]?.['id'] as number
		await deliver('customer.subscription.created', created.id, start - 5)
		expect(await getListener(mocks.listenerId)).toMatchObject({
			subscription_status: 'active',
			cancel_at: null,
		})

		await cancelSubscription()
		const canceling = await getListener(mocks.listenerId)
		expect(canceling?.subscription_status).toBe('active')
		expect(canceling?.cancel_at).not.toBeNull()
		expect(new Date(canceling?.cancel_at ?? '')).toEqual(
			new Date(canceling?.current_period_end ?? '')
		)
		expect(canceling?.cancel_requested_at).not.toBeNull()
		expect((await listServedListeners()).map((listener) => listener.id)).toContain(mocks.listenerId)
		expect((await businessCounts()).canceling).toBe(1)

		await deliver('customer.subscription.updated', created.id, start - 5)
		expect((await getListener(mocks.listenerId))?.cancel_at).toBe(canceling?.cancel_at)

		const periodEnd = Math.floor(new Date(canceling?.current_period_end ?? '').getTime() / 1000)
		const advancedAt = Math.floor(Date.now() / 1000)
		await client.testHelpers.testClocks.advance(clock.id, { frozen_time: periodEnd + 3600 })
		await until(async () => {
			const current = await client.testHelpers.testClocks.retrieve(clock.id)
			return current.status === 'ready' ? current : null
		}, 'the test clock to advance')
		expect((await client.subscriptions.retrieve(created.id)).status).toBe('canceled')

		await deliver('customer.subscription.deleted', created.id, advancedAt - 5)
		const ended = await getListener(mocks.listenerId)
		expect(ended?.subscription_status).toBe('canceled')
		expect(ended?.service_ended_at).not.toBeNull()
		expect((await listServedListeners()).map((listener) => listener.id)).not.toContain(
			mocks.listenerId
		)
		expect(await businessCounts()).toMatchObject({ canceling: 0, endedThisWeek: 1 })
		expect(mocks.mailer.sent.map((message) => message.subject)).toEqual([
			'Your Diffcast subscription has ended',
		])
	}, 240_000)
})
