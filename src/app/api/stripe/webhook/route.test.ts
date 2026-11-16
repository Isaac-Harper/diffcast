import Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeMailer } from '@/lib/email/fake-mailer'
import { POST } from './route'

const SECRET = 'whsec_test_secret'

interface FakeListener {
	id: number
	email: string
	comped: boolean
	customerId: string
	subscriptionId: string
	status: string
	periodEnd: Date | null
	interestsSeeded: number
}

const state = vi.hoisted(() => ({
	events: new Set<string>(),
	signups: new Map<
		string,
		{
			id: number
			email: string
			timezone: string
			interests_text: string
			stack_text: string
			days: number[]
			listener_id: number | null
			completed_at: string | null
		}
	>(),
	listeners: [] as FakeListener[],
	subscriptions: new Map<string, { status: string; periodEnd: number }>(),
	tokens: [] as { listenerId: number; label: string }[],
	taggedCustomers: [] as string[],
	mailer: null as unknown as FakeMailer,
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))

vi.mock('@/lib/email/resend-mailer', () => ({ currentMailer: () => state.mailer }))

vi.mock('@/lib/billing/stripe', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/billing/stripe')>()
	const verifier = new Stripe('sk_test_unused')
	return {
		...original,
		webhookSecret: () => SECRET,
		stripe: () => ({
			webhooks: verifier.webhooks,
			subscriptions: {
				retrieve: async (id: string) => {
					const subscription = state.subscriptions.get(id)
					if (!subscription) throw new Error(`no subscription ${id}`)
					return {
						id,
						status: subscription.status,
						items: { data: [{ current_period_end: subscription.periodEnd }] },
					}
				},
			},
			customers: {
				update: async (id: string) => {
					state.taggedCustomers.push(id)
				},
			},
		}),
	}
})

vi.mock('@/lib/store/feed-tokens', () => ({
	addFeedToken: async (listenerId: number, label: string) => {
		state.tokens.push({ listenerId, label })
	},
}))

vi.mock('@/lib/store/billing', () => ({
	recordStripeEvent: async (id: string) => {
		if (state.events.has(id)) return false
		state.events.add(id)
		return true
	},
	forgetStripeEvent: async (id: string) => {
		state.events.delete(id)
	},
	signupForSession: async (sessionId: string) => state.signups.get(sessionId) ?? null,
	upsertPaidListener: async (input: {
		signupId: number
		email: string
		customerId: string
		subscription: { subscriptionId: string; status: string; periodEnd: Date | null }
	}) => {
		let listener = state.listeners.find((entry) => entry.customerId === input.customerId)
		if (!listener) {
			listener = {
				id: state.listeners.length + 1,
				email: input.email,
				comped: false,
				customerId: input.customerId,
				subscriptionId: input.subscription.subscriptionId,
				status: input.subscription.status,
				periodEnd: input.subscription.periodEnd,
				interestsSeeded: 6,
			}
			state.listeners.push(listener)
		}
		listener.status = input.subscription.status
		listener.periodEnd = input.subscription.periodEnd
		for (const signup of state.signups.values()) {
			if (signup.id === input.signupId) signup.listener_id = listener.id
		}
		return listener.id
	},
	markSignupCompleted: async (signupId: number) => {
		for (const signup of state.signups.values()) {
			if (signup.id === signupId && signup.completed_at === null) signup.completed_at = 'now'
		}
	},
	listenerForSubscription: async (id: string) =>
		state.listeners.find((listener) => listener.subscriptionId === id)?.id ?? null,
	syncSubscription: async (input: { subscriptionId: string; status: string; periodEnd: Date }) => {
		const listener = state.listeners.find((entry) => entry.subscriptionId === input.subscriptionId)
		if (!listener) return null
		const previousStatus = listener.status
		listener.status = input.status
		listener.periodEnd = input.periodEnd
		return {
			listenerId: listener.id,
			email: listener.email,
			comped: listener.comped,
			previousStatus,
			status: input.status,
		}
	},
}))

const PERIOD_END = 1_800_000_000
let eventCounter = 0

function signed(event: Record<string, unknown>, secret: string = SECRET): Request {
	const payload = JSON.stringify(event)
	const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret })
	return new Request('https://diffcast.fm/api/stripe/webhook', {
		method: 'POST',
		headers: {
			'stripe-signature': signature,
			host: 'diffcast.fm',
			'content-type': 'application/json',
		},
		body: payload,
	})
}

function event(type: string, object: Record<string, unknown>, id?: string) {
	eventCounter += 1
	return { id: id ?? `evt_${eventCounter}`, object: 'event', type, data: { object } }
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
	return {
		id: 'cs_test_one',
		object: 'checkout.session',
		mode: 'subscription',
		status: 'complete',
		payment_status: 'paid',
		customer: 'cus_one',
		subscription: 'sub_one',
		metadata: { project: 'diffcast', signup_id: '1' },
		...overrides,
	}
}

async function send(request: Request) {
	const response = await POST(request)
	return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

beforeEach(() => {
	state.events = new Set()
	state.listeners = []
	state.tokens = []
	state.taggedCustomers = []
	state.mailer = new FakeMailer()
	state.subscriptions = new Map([['sub_one', { status: 'active', periodEnd: PERIOD_END }]])
	state.signups = new Map([
		[
			'cs_test_one',
			{
				id: 1,
				email: 'ana.lopez@example.com',
				timezone: 'Europe/Berlin',
				interests_text: 'Rust',
				stack_text: 'npm:next',
				days: [1, 2, 3, 4, 5, 6, 7],
				listener_id: null,
				completed_at: null,
			},
		],
	])
})

describe('stripe webhook', () => {
	it('rejects a missing or bad signature and acts on nothing', async () => {
		const body = event('checkout.session.completed', checkoutSession())
		expect((await send(signed(body, 'whsec_wrong'))).status).toBe(400)
		const unsigned = new Request('https://diffcast.fm/api/stripe/webhook', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect((await POST(unsigned)).status).toBe(400)
		const tampered = signed(body)
		const forged = new Request(tampered.url, {
			method: 'POST',
			headers: tampered.headers,
			body: JSON.stringify({ ...body, type: 'customer.subscription.deleted' }),
		})
		expect((await POST(forged)).status).toBe(400)
		expect(state.events.size).toBe(0)
		expect(state.listeners).toEqual([])
	})

	it('creates the listener from a paid checkout, issues a token and emails the welcome', async () => {
		const result = await send(signed(event('checkout.session.completed', checkoutSession())))
		expect(result).toEqual({ status: 200, body: { received: true, outcome: 'handled' } })
		expect(state.listeners).toMatchObject([
			{
				id: 1,
				email: 'ana.lopez@example.com',
				customerId: 'cus_one',
				subscriptionId: 'sub_one',
				status: 'active',
				periodEnd: new Date(PERIOD_END * 1000),
			},
		])
		expect(state.tokens).toEqual([{ listenerId: 1, label: 'Welcome email' }])
		expect(state.taggedCustomers).toEqual(['cus_one'])
		expect(state.mailer.sent).toHaveLength(1)
		expect(state.mailer.sent[0]?.to).toBe('ana.lopez@example.com')
		expect(state.mailer.sent[0]?.text).toMatch(/https:\/\/diffcast\.fm\/api\/feed\/[0-9a-f]{64}/)
		expect(state.signups.get('cs_test_one')?.completed_at).toBe('now')
	})

	it('answers a duplicate event with 200 and does nothing again', async () => {
		const body = event('checkout.session.completed', checkoutSession(), 'evt_same')
		await send(signed(body))
		const again = await send(signed(body))
		expect(again).toEqual({ status: 200, body: { received: true, duplicate: true } })
		expect(state.listeners).toHaveLength(1)
		expect(state.mailer.sent).toHaveLength(1)
	})

	it('completes once per session even across different events', async () => {
		await send(signed(event('checkout.session.completed', checkoutSession())))
		await send(signed(event('checkout.session.async_payment_succeeded', checkoutSession())))
		await send(signed(event('checkout.session.completed', checkoutSession())))
		expect(state.listeners).toHaveLength(1)
		expect(state.tokens).toHaveLength(1)
		expect(state.mailer.sent).toHaveLength(1)
	})

	it('forgets the event when the welcome email fails, so the retry finishes the job', async () => {
		state.mailer.failNext = true
		const body = event('checkout.session.completed', checkoutSession(), 'evt_retry')
		await expect(POST(signed(body))).rejects.toThrow('Fake mailer failure')
		expect(state.events.has('evt_retry')).toBe(false)
		expect(state.signups.get('cs_test_one')?.completed_at).toBeNull()
		expect((await send(signed(body))).status).toBe(200)
		expect(state.listeners).toHaveLength(1)
		expect(state.mailer.sent).toHaveLength(1)
		expect(state.signups.get('cs_test_one')?.completed_at).toBe('now')
	})

	it('ignores unpaid checkouts, other projects and unknown events', async () => {
		const outcomes = [
			await send(
				signed(event('checkout.session.completed', checkoutSession({ payment_status: 'unpaid' })))
			),
			await send(
				signed(
					event('checkout.session.completed', checkoutSession({ metadata: { project: 'cvzx' } }))
				)
			),
			await send(signed(event('charge.refunded', { id: 'ch_1', object: 'charge' }))),
		]
		expect(outcomes).toEqual(
			Array(3).fill({ status: 200, body: { received: true, outcome: 'ignored' } })
		)
		expect(state.listeners).toEqual([])
	})

	it('fails loudly on a Diffcast checkout without a signup row', async () => {
		const body = event('checkout.session.completed', checkoutSession({ id: 'cs_test_missing' }))
		await expect(POST(signed(body))).rejects.toThrow(/no signup row/)
	})

	it('syncs status and period end from Stripe on subscription events and invoice.paid', async () => {
		await send(signed(event('checkout.session.completed', checkoutSession())))
		state.subscriptions.set('sub_one', { status: 'past_due', periodEnd: PERIOD_END })
		await send(
			signed(event('customer.subscription.updated', { id: 'sub_one', object: 'subscription' }))
		)
		expect(state.listeners[0]?.status).toBe('past_due')
		expect(state.mailer.sent).toHaveLength(1)

		state.subscriptions.set('sub_one', { status: 'active', periodEnd: PERIOD_END + 2_592_000 })
		await send(
			signed(
				event('invoice.paid', {
					id: 'in_1',
					object: 'invoice',
					parent: {
						type: 'subscription_details',
						subscription_details: { subscription: 'sub_one' },
					},
				})
			)
		)
		expect(state.listeners[0]?.periodEnd).toEqual(new Date((PERIOD_END + 2_592_000) * 1000))
		expect(state.listeners[0]?.status).toBe('active')
	})

	it('stops service on deleted or unpaid and emails once, keeping the listener', async () => {
		await send(signed(event('checkout.session.completed', checkoutSession())))
		state.subscriptions.set('sub_one', { status: 'canceled', periodEnd: PERIOD_END })
		await send(
			signed(event('customer.subscription.deleted', { id: 'sub_one', object: 'subscription' }))
		)
		expect(state.listeners).toHaveLength(1)
		expect(state.listeners[0]?.status).toBe('canceled')
		expect(state.mailer.sent.map((message) => message.subject)).toEqual([
			'Your Diffcast feed is ready',
			'Your Diffcast subscription has ended',
		])
		await send(
			signed(event('customer.subscription.updated', { id: 'sub_one', object: 'subscription' }))
		)
		expect(state.mailer.sent).toHaveLength(2)
	})

	it('ignores subscription events for subscriptions it does not know', async () => {
		const result = await send(
			signed(event('customer.subscription.created', { id: 'sub_other', object: 'subscription' }))
		)
		expect(result.body).toEqual({ received: true, outcome: 'ignored' })
	})
})
