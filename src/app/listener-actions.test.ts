import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeMailer } from '@/lib/email/fake-mailer'
import {
	hashLoginToken,
	LISTENER_COOKIE,
	listenerSigningKey,
	signListenerSession,
} from '@/lib/listener-session'
import { signInByEmail, signInByIp, SIGN_IN_SENT } from '@/lib/signin'
import { signupAttempts } from '@/lib/signup'
import { issueAccountFeedLink, saveAccountDays, signOutEverywhere } from './account/actions'
import { confirmSignIn, requestSignIn } from './signin/actions'
import { startCheckout } from './start/actions'

const SECRET = 's'.repeat(40)

const state = vi.hoisted(() => ({
	cookie: undefined as string | undefined,
	setCookies: [] as { name: string; value: string }[],
	ip: '192.0.2.70',
	served: new Map<string, { id: number; email: string }>(),
	loginTokens: new Map<string, { listenerId: number; used: boolean }>(),
	signups: [] as unknown[],
	sessions: [] as Record<string, unknown>[],
	days: [] as { listenerId: number; days: number[] }[],
	tokens: [] as { listenerId: number; label: string }[],
	revoked: [] as number[],
	epochs: new Map<number, number>(),
	mailer: null as unknown as FakeMailer,
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('next/cache', () => ({ refresh: () => undefined }))
vi.mock('next/headers', () => ({
	headers: async () =>
		new Headers({ 'x-forwarded-for': state.ip, host: 'diffcast.fm', 'x-forwarded-proto': 'https' }),
	cookies: async () => ({
		get: (name: string) =>
			name === LISTENER_COOKIE && state.cookie ? { name, value: state.cookie } : undefined,
		set: (name: string, value: string) => {
			state.setCookies.push({ name, value })
			if (name === LISTENER_COOKIE) state.cookie = value
		},
		delete: (name: string) => {
			if (name === LISTENER_COOKIE) state.cookie = undefined
		},
	}),
}))
vi.mock('@/lib/email/resend-mailer', () => ({ currentMailer: () => state.mailer }))
vi.mock('@/lib/billing/stripe', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/billing/stripe')>()),
	priceId: () => 'price_standard',
	stripe: () => ({
		checkout: {
			sessions: {
				create: async (params: Record<string, unknown>) => {
					state.sessions.push(params)
					return { id: 'cs_test_new', url: 'https://checkout.stripe.com/c/pay/cs_test_new' }
				},
			},
		},
	}),
}))
vi.mock('@/lib/store/listeners', () => ({
	findServedListenerByEmail: async (email: string) => state.served.get(email.toLowerCase()) ?? null,
	setListenerDays: async (listenerId: number, days: number[]) => {
		state.days.push({ listenerId, days })
	},
	sessionEpoch: async (listenerId: number) => state.epochs.get(listenerId) ?? null,
	bumpSessionEpoch: async (listenerId: number) => {
		const next = (state.epochs.get(listenerId) ?? 0) + 1
		state.epochs.set(listenerId, next)
		return next
	},
}))
vi.mock('@/lib/store/billing', () => ({
	createSignup: async (input: unknown) => {
		state.signups.push(input)
		return 7
	},
	returningCustomer: async () => null,
	attachCheckoutSession: async () => undefined,
}))
vi.mock('@/lib/store/login-tokens', () => ({
	addLoginToken: async (listenerId: number, hash: string) => {
		state.loginTokens.set(hash, { listenerId, used: false })
	},
	consumeLoginToken: async (hash: string) => {
		const entry = state.loginTokens.get(hash)
		if (!entry || entry.used) return null
		entry.used = true
		return entry.listenerId
	},
}))
vi.mock('@/lib/store/feed-tokens', () => ({
	addFeedToken: async (listenerId: number, label: string) => {
		state.tokens.push({ listenerId, label })
	},
	revokeListenerFeedTokens: async (listenerId: number) => {
		state.revoked.push(listenerId)
	},
}))

function form(values: Record<string, string | string[]>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) {
		for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry)
	}
	return data
}

const IDLE = { status: 'idle' as const, message: '' }

beforeEach(() => {
	vi.stubEnv('DIFFCAST_SESSION_SECRET', SECRET)
	state.cookie = undefined
	state.setCookies = []
	state.ip = '192.0.2.70'
	state.served = new Map([['ana@example.com', { id: 5, email: 'ana@example.com' }]])
	state.loginTokens = new Map()
	state.signups = []
	state.sessions = []
	state.days = []
	state.tokens = []
	state.revoked = []
	state.epochs = new Map([[5, 2]])
	state.mailer = new FakeMailer()
	signupAttempts.clear()
	signInByIp.clear()
	signInByEmail.clear()
})

describe('start checkout', () => {
	const valid = {
		email: 'new@example.com',
		timezone: 'America/Chicago',
		days: ['1', '2'],
		topics: ['Open source'],
	}

	it('saves the signup and redirects to a subscription checkout tagged for diffcast', async () => {
		await expect(startCheckout(IDLE, form(valid))).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*checkout\.stripe\.com/),
		})
		expect(state.signups).toHaveLength(1)
		expect(state.sessions).toEqual([
			expect.objectContaining({
				mode: 'subscription',
				line_items: [{ price: 'price_standard', quantity: 1 }],
				customer_email: 'new@example.com',
				client_reference_id: '7',
				metadata: { project: 'diffcast', signup_id: '7' },
				subscription_data: { metadata: { project: 'diffcast' } },
				allow_promotion_codes: true,
				success_url: 'https://diffcast.fm/welcome?session_id={CHECKOUT_SESSION_ID}',
				cancel_url: 'https://diffcast.fm/start?canceled=1',
			}),
		])
		expect(state.sessions[0]).not.toHaveProperty('payment_method_types')
	})

	it('sends an existing subscriber to sign in instead of a second checkout', async () => {
		const result = await startCheckout(IDLE, form({ ...valid, email: 'ANA@example.com' }))
		expect(result.status).toBe('existing')
		expect(state.sessions).toEqual([])
		expect(state.signups).toEqual([])
	})

	it('rejects bad input and throttles by IP', async () => {
		expect((await startCheckout(IDLE, form({ ...valid, timezone: 'Nope' }))).status).toBe('error')
		for (let index = 0; index < 5; index += 1) signupAttempts.add(state.ip)
		expect(await startCheckout(IDLE, form(valid))).toEqual({
			status: 'error',
			message: 'Too many attempts. Try again in ten minutes.',
		})
		expect(state.sessions).toEqual([])
	})
})

describe('sign in', () => {
	it('emails a one time link to a served listener and gives everyone the same answer', async () => {
		const known = await requestSignIn(IDLE, form({ email: 'Ana@Example.com' }))
		const unknown = await requestSignIn(IDLE, form({ email: 'nobody@example.com' }))
		expect(known).toEqual({ status: 'saved', message: SIGN_IN_SENT })
		expect(unknown).toEqual(known)
		expect(state.mailer.sent).toHaveLength(1)
		const link = /token=([0-9a-f]{64})/.exec(state.mailer.sent[0]?.text ?? '')?.[1]
		if (!link) throw new Error('no link')
		expect(state.loginTokens.has(link)).toBe(false)
		expect(state.loginTokens.get(hashLoginToken(link))).toEqual({ listenerId: 5, used: false })
	})

	it('signs in once with the link, then refuses it', async () => {
		await requestSignIn(IDLE, form({ email: 'ana@example.com' }))
		const token = /token=([0-9a-f]{64})/.exec(state.mailer.sent[0]?.text ?? '')?.[1] ?? ''
		await expect(confirmSignIn(form({ token }))).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/account/),
		})
		expect(state.setCookies.map((cookie) => cookie.name)).toEqual([LISTENER_COOKIE])
		await expect(confirmSignIn(form({ token }))).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/signin\?error=expired/),
		})
		await expect(confirmSignIn(form({ token: 'nope' }))).rejects.toMatchObject({
			digest: expect.stringMatching(/error=expired/),
		})
	})

	it('throttles per email without saying so, and per IP', async () => {
		for (let index = 0; index < 5; index += 1) {
			state.ip = `192.0.2.${index}`
			await requestSignIn(IDLE, form({ email: 'ana@example.com' }))
		}
		expect(state.mailer.sent).toHaveLength(3)
		state.ip = '198.51.100.1'
		for (let index = 0; index < 10; index += 1) {
			await requestSignIn(IDLE, form({ email: `x${index}@example.com` }))
		}
		expect((await requestSignIn(IDLE, form({ email: 'y@example.com' }))).status).toBe('error')
	})
})

describe('account actions', () => {
	it('need a listener session and act only on its listener', async () => {
		await expect(saveAccountDays(IDLE, form({ days: ['1'] }))).rejects.toMatchObject({
			digest: expect.stringMatching(/\/signin/),
		})
		state.cookie = session()
		expect(await saveAccountDays(IDLE, form({ days: ['3', '1'], listenerId: '9' }))).toEqual({
			status: 'saved',
			message: 'Days saved.',
		})
		expect(state.days).toEqual([{ listenerId: 5, days: [1, 3] }])
	})

	it('refuses a session from an older epoch', async () => {
		state.cookie = signListenerSession({ listenerId: 5, epoch: 1 }, listenerSigningKey())
		await expect(saveAccountDays(IDLE, form({ days: ['1'] }))).rejects.toMatchObject({
			digest: expect.stringMatching(/\/signin/),
		})
		expect(state.days).toEqual([])
	})

	it('issues a new feed link and revokes the old ones only when asked, ending other sessions', async () => {
		state.cookie = session()
		const kept = await issueAccountFeedLink({ status: 'idle' }, form({}))
		expect(kept).toMatchObject({ status: 'issued', revoked: false })
		expect(state.epochs.get(5)).toBe(2)
		const otherBrowser = session()
		const revoked = await issueAccountFeedLink({ status: 'idle' }, form({ revokeOld: 'on' }))
		expect(revoked).toMatchObject({
			status: 'issued',
			revoked: true,
			feedUrl: expect.stringMatching(/^https:\/\/diffcast\.fm\/api\/feed\/[0-9a-f]{64}$/),
		})
		expect(state.revoked).toEqual([5])
		expect(state.tokens).toEqual([
			{ listenerId: 5, label: 'Account' },
			{ listenerId: 5, label: 'Account' },
		])
		expect(state.epochs.get(5)).toBe(3)
		expect(state.cookie).not.toBe(otherBrowser)
		expect((await saveAccountDays(IDLE, form({ days: ['2'] }))).status).toBe('saved')
		state.cookie = otherBrowser
		await expect(saveAccountDays(IDLE, form({ days: ['4'] }))).rejects.toMatchObject({
			digest: expect.stringMatching(/\/signin/),
		})
	})

	it('signs out everywhere, this browser included', async () => {
		state.cookie = session()
		const otherBrowser = session()
		await expect(signOutEverywhere()).rejects.toMatchObject({
			digest: expect.stringMatching(/\/signin\?signed_out=everywhere/),
		})
		expect(state.epochs.get(5)).toBe(3)
		expect(state.cookie).toBeUndefined()
		state.cookie = otherBrowser
		await expect(saveAccountDays(IDLE, form({ days: ['4'] }))).rejects.toMatchObject({
			digest: expect.stringMatching(/\/signin/),
		})
	})
})

function session(): string {
	return signListenerSession(
		{ listenerId: 5, epoch: state.epochs.get(5) ?? 0 },
		listenerSigningKey()
	)
}
