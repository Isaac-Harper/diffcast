import { describe, expect, it } from 'vitest'
import { customerDashboardUrl } from './billing/stripe'
import { businessReport } from './business'
import { signInEmail, subscriptionEndedEmail, welcomeEmail } from './email/templates'
import {
	hashLoginToken,
	isLoginToken,
	listenerSigningKey,
	newLoginToken,
	signListenerSession,
	verifyListenerSession,
} from './listener-session'
import { isServed, planOf } from './served'
import { signingKey, signSession, verifySession } from './session'
import { nameFromEmail, parseSignupForm } from './signup'

function form(values: Record<string, string | string[]>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) {
		for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry)
	}
	return data
}

describe('served rule', () => {
	const base = { active: true, comped: false, subscription_status: null }

	it('serves comped and paying listeners, including past due', () => {
		expect(isServed({ ...base, comped: true })).toBe(true)
		expect(isServed({ ...base, subscription_status: 'active' })).toBe(true)
		expect(isServed({ ...base, subscription_status: 'past_due' })).toBe(true)
	})

	it('stops ended, unpaid, incomplete and inactive listeners', () => {
		for (const status of [
			null,
			'canceled',
			'unpaid',
			'incomplete',
			'incomplete_expired',
			'paused',
		]) {
			expect(isServed({ ...base, subscription_status: status }), String(status)).toBe(false)
		}
		expect(isServed({ ...base, active: false, comped: true })).toBe(false)
		expect(isServed({ ...base, active: false, subscription_status: 'active' })).toBe(false)
	})

	it('names the plan', () => {
		expect(planOf({ comped: true, subscription_status: 'canceled' })).toBe('comped')
		expect(planOf({ comped: false, subscription_status: null })).toBe('none')
		expect(planOf({ comped: false, subscription_status: 'past_due' })).toBe('past_due')
		expect(planOf({ comped: false, subscription_status: 'unpaid' })).toBe('canceled')
	})
})

describe('listener sessions', () => {
	const key = listenerSigningKey({ DIFFCAST_SESSION_SECRET: 's'.repeat(40) })

	it('round trips the listener id until it expires', () => {
		const token = signListenerSession(42, key, 1_000)
		expect(verifyListenerSession(token, key, 2_000)).toBe(42)
		expect(verifyListenerSession(token, key, 1_000 + 31 * 24 * 3600 * 1000)).toBeNull()
	})

	it('rejects tampering, other keys and the admin cookie', () => {
		const token = signListenerSession(42, key, 1_000)
		expect(verifyListenerSession(token.replace(/^42/, '43'), key, 2_000)).toBeNull()
		expect(verifyListenerSession(token, `${key}x`, 2_000)).toBeNull()
		const admin = signSession(signingKey('s'.repeat(40), 'pw'), 1_000)
		expect(verifyListenerSession(admin, key, 2_000)).toBeNull()
		expect(verifySession(token, signingKey('s'.repeat(40), 'pw'), 2_000)).toBe(false)
		expect(verifyListenerSession(undefined, key)).toBeNull()
		expect(verifyListenerSession('a.b.c', key)).toBeNull()
	})

	it('derives a key different from the admin one and needs a long secret', () => {
		expect(key).not.toBe(signingKey('s'.repeat(40), ''))
		expect(() => listenerSigningKey({ DIFFCAST_SESSION_SECRET: 'short' })).toThrow()
		expect(() => listenerSigningKey({})).toThrow()
	})

	it('makes 32 byte login tokens and stores only a hash', () => {
		const token = newLoginToken()
		expect(isLoginToken(token)).toBe(true)
		expect(hashLoginToken(token)).not.toBe(token)
		expect(hashLoginToken(token)).toHaveLength(64)
		expect(isLoginToken('z'.repeat(64))).toBe(false)
	})
})

describe('signup form', () => {
	const valid = {
		email: ' Ana.Lopez+news@example.com ',
		timezone: 'Europe/Berlin',
		interests: 'Rust, databases',
		stack: '{"dependencies":{"next":"16"}}',
		days: ['1', '3', '5'],
	}

	it('parses a complete signup', () => {
		expect(parseSignupForm(form(valid))).toEqual({
			ok: true,
			input: {
				email: 'Ana.Lopez+news@example.com',
				timezone: 'Europe/Berlin',
				interestsText: 'Rust, databases',
				stackText: '{"dependencies":{"next":"16"}}',
				days: [1, 3, 5],
			},
		})
		expect(nameFromEmail('ana.lopez+news@example.com')).toBe('Ana Lopez')
	})

	it('rejects a bad email, time zone, stack or no days', () => {
		expect(parseSignupForm(form({ ...valid, email: 'nope' })).ok).toBe(false)
		expect(parseSignupForm(form({ ...valid, timezone: 'Mars/Base' })).ok).toBe(false)
		expect(parseSignupForm(form({ ...valid, timezone: '' })).ok).toBe(false)
		expect(parseSignupForm(form({ ...valid, days: [] }))).toEqual({
			ok: false,
			error: 'Pick at least one day.',
		})
		expect(parseSignupForm(form({ ...valid, stack: '{"dependencies": ' })).ok).toBe(false)
		expect(parseSignupForm(form({ ...valid, interests: 'x'.repeat(2001) })).ok).toBe(false)
	})
})

describe('business report', () => {
	it('counts MRR from paying listeners only and the 30 day margin', () => {
		const report = businessReport({
			served: 5,
			paying: 3,
			comped: 2,
			signupsStarted: 4,
			signupsCompleted: 3,
			episodesToday: 5,
			failuresToday: 0,
			averageCost7: 0.5,
			maxCost7: 0.7,
			episodeCost30: 60,
		})
		expect(report.mrr).toBe(75)
		expect(report.revenue30).toBe(75)
		expect(report.margin30).toBe(15)
	})
})

describe('emails and links', () => {
	it('puts both links in the welcome email, text and html, escaped', () => {
		const email = welcomeEmail({
			to: 'ana@example.com',
			feedUrl: 'https://diffcast.fm/api/feed/abc',
			pageUrl: 'https://diffcast.fm/l/abc?a=1&b=2',
		})
		expect(email.text).toContain('https://diffcast.fm/api/feed/abc')
		expect(email.text).toContain('https://diffcast.fm/l/abc?a=1&b=2')
		expect(email.html).toContain('https://diffcast.fm/l/abc?a=1&amp;b=2')
		expect(email.text).toContain('/signin')
		expect(`${email.text}${email.html}`).not.toMatch(/[–—]/)
	})

	it('builds the sign in and ended emails', () => {
		expect(signInEmail({ to: 'a@b.co', url: 'https://x/signin/confirm?token=t' }).text).toContain(
			'token=t'
		)
		expect(subscriptionEndedEmail({ to: 'a@b.co' }).subject).toMatch(/ended/)
	})

	it('links the Stripe dashboard in test or live mode by key', () => {
		expect(customerDashboardUrl('cus_1', 'sk_test_x')).toBe(
			'https://dashboard.stripe.com/test/customers/cus_1'
		)
		expect(customerDashboardUrl('cus_1', 'sk_live_x')).toBe(
			'https://dashboard.stripe.com/customers/cus_1'
		)
	})
})
