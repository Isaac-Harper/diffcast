import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_STACK_TEXT, waitlistAttempts, waitlistName } from '@/lib/waitlist'
import { joinWaitlist } from './actions'

const state = vi.hoisted(() => ({
	rows: [] as { email: string; podcastApp: string | null; stackText: string }[],
	ip: '192.0.2.60',
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('next/headers', () => ({
	headers: async () => new Headers({ 'x-forwarded-for': state.ip }),
}))
vi.mock('@/lib/store/waitlist', () => ({
	addWaitlistEntry: async (input: {
		email: string
		podcastApp: string | null
		stackText: string
	}) => {
		if (state.rows.some((row) => row.email.toLowerCase() === input.email.toLowerCase())) return
		state.rows.push(input)
	},
}))

const IDLE = { status: 'idle' as const, message: '' }

function form(values: Record<string, string>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) data.set(key, value)
	return data
}

describe('joinWaitlist', () => {
	beforeEach(() => {
		state.rows.length = 0
		state.ip = '192.0.2.60'
		waitlistAttempts.clear()
	})

	it('writes one row with trimmed values', async () => {
		const result = await joinWaitlist(
			IDLE,
			form({ email: '  ana@example.com ', podcastApp: 'Overcast', stack: '  next\nreact  ' })
		)
		expect(result.status).toBe('joined')
		expect(state.rows).toEqual([
			{ email: 'ana@example.com', podcastApp: 'Overcast', stackText: 'next\nreact' },
		])
	})

	it('stores null for an empty podcast app and empty stack', async () => {
		await joinWaitlist(IDLE, form({ email: 'ana@example.com', podcastApp: '' }))
		expect(state.rows).toEqual([{ email: 'ana@example.com', podcastApp: null, stackText: '' }])
	})

	it('rejects an invalid or missing email', async () => {
		for (const email of ['nope', 'a@b', '', ' ']) {
			const result = await joinWaitlist(IDLE, form({ email }))
			expect(result, email).toEqual({ status: 'error', message: 'Enter a valid email address.' })
		}
		expect(await joinWaitlist(IDLE, form({}))).toEqual({
			status: 'error',
			message: 'Enter a valid email address.',
		})
		expect(state.rows).toEqual([])
	})

	it('rejects an unknown podcast app', async () => {
		const result = await joinWaitlist(IDLE, form({ email: 'ana@example.com', podcastApp: 'Zune' }))
		expect(result).toEqual({ status: 'error', message: 'Pick a podcast app from the list.' })
		expect(state.rows).toEqual([])
	})

	it('rejects a stack over the limit and accepts one at the limit', async () => {
		const over = await joinWaitlist(
			IDLE,
			form({ email: 'ana@example.com', stack: 'x'.repeat(MAX_STACK_TEXT + 1) })
		)
		expect(over).toEqual({ status: 'error', message: 'Keep the stack under 20000 characters.' })
		expect(state.rows).toEqual([])
		const at = await joinWaitlist(
			IDLE,
			form({ email: 'ana@example.com', stack: 'x'.repeat(MAX_STACK_TEXT) })
		)
		expect(at.status).toBe('joined')
		expect(state.rows[0]?.stackText).toHaveLength(MAX_STACK_TEXT)
	})

	it('returns success and writes nothing when the honeypot is filled', async () => {
		const first = await joinWaitlist(IDLE, form({ email: 'ana@example.com' }))
		state.rows.length = 0
		waitlistAttempts.clear()
		const result = await joinWaitlist(
			IDLE,
			form({ email: 'bot@example.com', website: 'https://spam.example' })
		)
		expect(result).toEqual(first)
		expect(state.rows).toEqual([])
		expect(waitlistAttempts.blocked(state.ip)).toBe(false)
		for (let index = 0; index < 5; index += 1) {
			await joinWaitlist(IDLE, form({ email: 'bot@example.com', website: 'x' }))
		}
		expect(waitlistAttempts.blocked(state.ip)).toBe(false)
	})

	it('does not count validation failures against the throttle', async () => {
		for (let index = 0; index < 10; index += 1) await joinWaitlist(IDLE, form({ email: 'nope' }))
		expect(waitlistAttempts.blocked(state.ip)).toBe(false)
	})

	it('blocks the sixth attempt from one IP and not another', async () => {
		for (let index = 0; index < 5; index += 1) {
			const result = await joinWaitlist(IDLE, form({ email: `user${index}@example.com` }))
			expect(result.status).toBe('joined')
		}
		const blocked = await joinWaitlist(IDLE, form({ email: 'user6@example.com' }))
		expect(blocked).toEqual({
			status: 'error',
			message: 'Too many attempts. Try again in ten minutes.',
		})
		expect(state.rows).toHaveLength(5)
		state.ip = '192.0.2.61'
		expect((await joinWaitlist(IDLE, form({ email: 'user6@example.com' }))).status).toBe('joined')
	})

	it('returns the same result for a duplicate email', async () => {
		const first = await joinWaitlist(IDLE, form({ email: 'ana@example.com' }))
		const second = await joinWaitlist(IDLE, form({ email: 'ANA@example.com' }))
		expect(second).toEqual(first)
		expect(state.rows).toHaveLength(1)
	})
})

describe('waitlistName', () => {
	it('builds a display name from the local part', () => {
		expect(waitlistName('ana.lima+x@example.com')).toBe('Ana Lima')
		expect(waitlistName('ana_lima-santos@example.com')).toBe('Ana Lima Santos')
		expect(waitlistName('ana@example.com')).toBe('Ana')
	})

	it('falls back to the local part when no words remain', () => {
		expect(waitlistName('+tag@example.com')).toBe('')
		expect(waitlistName('...@example.com')).toBe('...')
	})
})
