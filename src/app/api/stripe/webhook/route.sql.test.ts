import Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeMailer } from '@/lib/email/fake-mailer'
import { hashFeedToken } from '@/lib/feed-tokens'
import { DEFAULT_INTERESTS } from '@/lib/interests'
import { attachCheckoutSession, createSignup } from '@/lib/store/billing'
import { findServedFeedToken } from '@/lib/store/feed-tokens'
import { POST } from './route'

const SECRET = 'whsec_test_secret'
const PERIOD_END = 1_800_000_000

const fakes = vi.hoisted(() => ({
	mailer: null as unknown as FakeMailer,
	subscriptions: new Map<string, string>(),
	taggedCustomers: [] as string[],
}))

vi.mock('@/lib/db', async () => {
	const { createTestDatabase } = await import('@/test/pglite')
	return createTestDatabase()
})

vi.mock('@/lib/email/resend-mailer', () => ({ currentMailer: () => fakes.mailer }))

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
					const status = fakes.subscriptions.get(id)
					if (!status) throw new Error(`no subscription ${id}`)
					return { id, status, items: { data: [{ current_period_end: PERIOD_END }] } }
				},
			},
			customers: {
				update: async (id: string) => {
					fakes.taggedCustomers.push(id)
				},
			},
		}),
	}
})

const db = (await import('@/lib/db')) as unknown as {
	query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
}

let counter = 0

function unique(prefix: string): string {
	counter += 1
	return `${prefix}_${counter}`
}

function signed(event: Record<string, unknown>): Request {
	const payload = JSON.stringify(event)
	const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
	return new Request('https://diffcast.fm/api/stripe/webhook', {
		method: 'POST',
		headers: { 'stripe-signature': signature, host: 'diffcast.fm' },
		body: payload,
	})
}

function checkoutEvent(
	session: { id: string; customer: string; subscription: string },
	type = 'checkout.session.completed',
	id = unique('evt')
) {
	return {
		id,
		object: 'event',
		type,
		data: {
			object: {
				...session,
				object: 'checkout.session',
				mode: 'subscription',
				status: 'complete',
				payment_status: 'paid',
				metadata: { project: 'diffcast' },
			},
		},
	}
}

async function send(event: Record<string, unknown>) {
	const response = await POST(signed(event))
	return (await response.json()) as Record<string, unknown>
}

async function startCheckout(email: string, customer = unique('cus')) {
	const signupId = await createSignup({
		email,
		timezone: 'Europe/Berlin',
		interestsText: 'Rust and WebAssembly',
		stackText: 'npm:next',
		days: [1, 3, 5],
	})
	const session = { id: unique('cs_test'), customer, subscription: unique('sub') }
	await attachCheckoutSession(signupId, session.id)
	fakes.subscriptions.set(session.subscription, 'active')
	return { signupId, session }
}

function emailedToken(index = 0): string {
	const text = fakes.mailer.sent[index]?.text ?? ''
	const match = /https:\/\/diffcast\.fm\/api\/feed\/([0-9a-f]{64})/.exec(text)
	if (!match?.[1]) throw new Error(`No feed URL in email ${index}`)
	return match[1]
}

async function tokensOf(listenerId: number) {
	return db.query(
		`SELECT token_hash, label, revoked_at IS NOT NULL AS revoked
		FROM feed_tokens WHERE listener_id = $1 ORDER BY id`,
		[listenerId]
	)
}

async function signupRow(signupId: number) {
	const rows = await db.query(
		`SELECT listener_id, completed_at IS NOT NULL AS completed FROM signups WHERE id = $1`,
		[signupId]
	)
	return rows[0]
}

async function eventCount() {
	return (await db.query(`SELECT count(*)::int AS n FROM stripe_events`))[0]?.['n']
}

beforeEach(() => {
	fakes.mailer = new FakeMailer()
	fakes.taggedCustomers = []
})

describe('stripe webhook on the real schema', () => {
	it('turns a paid test mode checkout into a served listener and a working welcome email', async () => {
		const { signupId, session } = await startCheckout('ana.lopez@example.com')

		expect(await send(checkoutEvent(session))).toEqual({ received: true, outcome: 'handled' })

		const [listener] = await db.query(
			`SELECT id, name, email, timezone, focus, stack, days, comped, stripe_customer_id,
				stripe_subscription_id, subscription_status, current_period_end
			FROM listeners WHERE stripe_customer_id = $1`,
			[session.customer]
		)
		expect(listener).toMatchObject({
			name: 'Ana Lopez',
			email: 'ana.lopez@example.com',
			timezone: 'Europe/Berlin',
			focus: 'Rust and WebAssembly',
			stack: [{ ecosystem: 'npm', name: 'next' }],
			days: [1, 3, 5],
			comped: false,
			stripe_subscription_id: session.subscription,
			subscription_status: 'active',
			current_period_end: new Date(PERIOD_END * 1000),
		})
		const listenerId = listener?.['id'] as number
		const interests = await db.query(
			`SELECT topic FROM interests WHERE listener_id = $1 ORDER BY sort`,
			[listenerId]
		)
		expect(interests.map((row) => row['topic'])).toEqual([...DEFAULT_INTERESTS])
		expect(await signupRow(signupId)).toEqual({ listener_id: listenerId, completed: true })
		expect(fakes.taggedCustomers).toEqual([session.customer])

		expect(fakes.mailer.sent).toHaveLength(1)
		const email = fakes.mailer.sent[0]
		expect(email?.to).toBe('ana.lopez@example.com')
		expect(email?.subject).toBe('Your Diffcast feed is ready')
		const token = emailedToken()
		expect(email?.text).toContain(`https://diffcast.fm/l/${token}`)
		expect(email?.text).toContain('Follow a Show by URL')
		expect(email?.text).toContain('https://diffcast.fm/signin')
		expect(email?.html).toContain(`https://diffcast.fm/api/feed/${token}`)

		expect(await tokensOf(listenerId)).toEqual([
			{ token_hash: hashFeedToken(token), label: 'Welcome email', revoked: false },
		])
		expect(await findServedFeedToken(hashFeedToken(token))).toMatchObject({ listenerId })
	})

	it('does nothing again when Stripe redelivers the event or sends another for the session', async () => {
		const { session } = await startCheckout('retry@example.com')
		const first = checkoutEvent(session)
		await send(first)
		const events = await eventCount()

		expect(await send(first)).toEqual({ received: true, duplicate: true })
		expect(await send(checkoutEvent(session, 'checkout.session.async_payment_succeeded'))).toEqual({
			received: true,
			outcome: 'handled',
		})

		const listeners = await db.query(`SELECT id FROM listeners WHERE email = 'retry@example.com'`)
		expect(listeners).toHaveLength(1)
		expect(await tokensOf(listeners[0]?.['id'] as number)).toHaveLength(1)
		expect(fakes.mailer.sent).toHaveLength(1)
		expect(await eventCount()).toBe((events as number) + 1)
	})

	it('finishes on the retry after the welcome email fails, leaving one live token', async () => {
		const { signupId, session } = await startCheckout('flaky@example.com')
		const event = checkoutEvent(session)
		const before = await eventCount()

		fakes.mailer.failNext = true
		await expect(POST(signed(event))).rejects.toThrow('Fake mailer failure')
		expect(await eventCount()).toBe(before)
		expect((await signupRow(signupId))?.['completed']).toBe(false)

		expect(await send(event)).toEqual({ received: true, outcome: 'handled' })
		expect(fakes.mailer.sent).toHaveLength(1)
		const listenerId = (await signupRow(signupId))?.['listener_id'] as number
		const tokens = await tokensOf(listenerId)
		expect(tokens.map((row) => row['revoked'])).toEqual([true, false])
		expect(tokens[1]?.['token_hash']).toBe(hashFeedToken(emailedToken()))
		expect((await signupRow(signupId))?.['completed']).toBe(true)
		const listeners = await db.query(`SELECT id FROM listeners WHERE email = 'flaky@example.com'`)
		expect(listeners).toHaveLength(1)
	})

	it('revives the same listener when a returning customer checks out again', async () => {
		const first = await startCheckout('back@example.com')
		await send(checkoutEvent(first.session))
		fakes.subscriptions.set(first.session.subscription, 'canceled')
		await send({
			id: unique('evt'),
			object: 'event',
			type: 'customer.subscription.deleted',
			data: { object: { id: first.session.subscription, object: 'subscription' } },
		})

		const second = await startCheckout('back@example.com', first.session.customer)
		await send(checkoutEvent(second.session))

		const listeners = await db.query(
			`SELECT id, subscription_status, stripe_subscription_id FROM listeners
			WHERE email = 'back@example.com'`
		)
		expect(listeners).toEqual([
			{
				id: (await signupRow(first.signupId))?.['listener_id'],
				subscription_status: 'active',
				stripe_subscription_id: second.session.subscription,
			},
		])
		expect(fakes.mailer.sent.map((message) => message.subject)).toEqual([
			'Your Diffcast feed is ready',
			'Your Diffcast subscription has ended',
			'Your Diffcast feed is ready',
		])
		expect(await findServedFeedToken(hashFeedToken(emailedToken(2)))).not.toBeNull()
	})
})
