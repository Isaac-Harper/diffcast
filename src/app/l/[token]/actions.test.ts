import { beforeEach, describe, expect, it, vi } from 'vitest'
import { feedMisses } from '@/lib/feed-access'
import { hashFeedToken } from '@/lib/feed-tokens'
import { LISTENER_COOKIE, listenerSigningKey, verifyListenerSession } from '@/lib/listener-session'
import { openMyAccount, saveMyDays, saveMyInterests, submitFeedback } from './actions'

describe('open my account', () => {
	beforeEach(() => {
		vi.stubEnv('DIFFCAST_SESSION_SECRET', 's'.repeat(40))
		state.tokens = new Map([[hashFeedToken('1'.repeat(64)), { id: 11, listenerId: 1 }]])
		state.cookies = []
		state.remembered = undefined
		state.ip = '192.0.2.60'
		feedMisses.clear()
	})

	async function open(values: Record<string, string>): Promise<string> {
		const data = new FormData()
		for (const [key, value] of Object.entries(values)) data.set(key, value)
		try {
			await openMyAccount(data)
		} catch (error) {
			const digest = (error as { digest?: string }).digest ?? ''
			if (digest.startsWith('NEXT_REDIRECT')) return digest.split(';')[2] ?? ''
			throw error
		}
		throw new Error('openMyAccount did not redirect')
	}

	it('signs in the token listener and goes to the account', async () => {
		expect(await open({ token: '1'.repeat(64) })).toBe('/account')
		const session = state.cookies.find((cookie) => cookie.name === LISTENER_COOKIE)
		expect(verifyListenerSession(session?.value, listenerSigningKey())).toBe(1)
	})

	it('honours only safe next paths, then the remembered one', async () => {
		const authorize = '/oauth/authorize?client_id=a&state=b'
		expect(await open({ token: '1'.repeat(64), next: authorize })).toBe(authorize)
		expect(await open({ token: '1'.repeat(64), next: 'https://evil.example/' })).toBe('/account')
		state.remembered = authorize
		expect(await open({ token: '1'.repeat(64) })).toBe(authorize)
		expect(state.remembered).toBeUndefined()
	})

	it('sets no session for a bad token', async () => {
		expect(await open({ token: '9'.repeat(64) })).toBe('/signin?error=expired')
		expect(state.cookies).toEqual([])
	})
})

const state = vi.hoisted(() => ({
	tokens: new Map<string, { id: number; listenerId: number }>(),
	feedback: [] as { episodeId: number; input: unknown }[],
	interests: [] as { listenerId: number; rows: unknown }[],
	days: [] as { listenerId: number; days: number[] }[],
	ip: '192.0.2.50',
	cookies: [] as { name: string; value: string }[],
	remembered: undefined as string | undefined,
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('next/cache', () => ({ refresh: () => undefined }))
vi.mock('next/headers', () => ({
	headers: async () => new Headers({ 'x-forwarded-for': state.ip }),
	cookies: async () => ({
		get: (name: string) =>
			name === 'diffcast_return' && state.remembered
				? { name, value: state.remembered }
				: undefined,
		set: (name: string, value: string) => {
			state.cookies.push({ name, value })
		},
		delete: (name: string) => {
			if (name === 'diffcast_return') state.remembered = undefined
		},
	}),
}))
vi.mock('@/lib/store/feed-tokens', () => ({
	findServedFeedToken: async (hash: string) => state.tokens.get(hash) ?? null,
}))
vi.mock('@/lib/store/episodes', () => ({
	listenerOwnsEpisode: async (listenerId: number, episodeId: number) =>
		(listenerId === 1 && episodeId === 101) || (listenerId === 2 && episodeId === 202),
}))
vi.mock('@/lib/store/interests', () => ({
	saveInterests: async (listenerId: number, rows: unknown) => {
		state.interests.push({ listenerId, rows })
	},
}))
vi.mock('@/lib/store/listeners', () => ({
	setListenerDays: async (listenerId: number, days: number[]) => {
		state.days.push({ listenerId, days })
	},
}))
vi.mock('@/lib/store/feedback', () => ({
	addFeedback: async (episodeId: number, input: unknown) => {
		state.feedback.push({ episodeId, input })
	},
}))

const ONE = '1'.repeat(64)
const REVOKED = '9'.repeat(64)
const IDLE = { status: 'idle' as const, message: '' }

function form(values: Record<string, string>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) data.set(key, value)
	return data
}

describe('listener page actions', () => {
	beforeEach(() => {
		state.tokens = new Map([[hashFeedToken(ONE), { id: 11, listenerId: 1 }]])
		state.feedback.length = 0
		state.interests.length = 0
		state.days.length = 0
		state.ip = '192.0.2.50'
		feedMisses.clear()
	})

	it('saves feedback on the listener own episode', async () => {
		const result = await submitFeedback(
			IDLE,
			form({ token: ONE, episodeId: '101', listened: 'yes', useful: 'up', note: 'Good' })
		)
		expect(result.status).toBe('saved')
		expect(state.feedback).toEqual([
			{ episodeId: 101, input: { listened: 'yes', useful: 'up', note: 'Good' } },
		])
	})

	it("rejects feedback on another listener's episode", async () => {
		const result = await submitFeedback(
			IDLE,
			form({ token: ONE, episodeId: '202', listened: 'yes' })
		)
		expect(result).toEqual({ status: 'error', message: 'Unknown episode.' })
		expect(state.feedback).toEqual([])
	})

	it('rejects a revoked or malformed token and bad input', async () => {
		for (const token of [REVOKED, 'nope', '']) {
			const result = await submitFeedback(IDLE, form({ token, episodeId: '101', listened: 'yes' }))
			expect(result.status, token).toBe('error')
		}
		const bad = await submitFeedback(
			IDLE,
			form({ token: ONE, episodeId: '101', listened: 'kinda' })
		)
		expect(bad.status).toBe('error')
		expect(state.feedback).toEqual([])
	})

	it('applies the miss throttle: a blocked IP cannot use even a valid token', async () => {
		for (let index = 0; index < 10; index += 1) feedMisses.add(state.ip)
		const feedback = await submitFeedback(
			IDLE,
			form({ token: ONE, episodeId: '101', listened: 'yes' })
		)
		expect(feedback).toEqual({ status: 'error', message: 'Too many attempts. Try again later.' })
		expect(state.feedback).toEqual([])
		state.ip = '192.0.2.51'
		const allowed = await submitFeedback(
			IDLE,
			form({ token: ONE, episodeId: '101', listened: 'yes' })
		)
		expect(allowed.status).toBe('saved')
	})

	it('counts a bad token as a miss', async () => {
		await submitFeedback(IDLE, form({ token: REVOKED, episodeId: '101', listened: 'yes' }))
		expect(feedMisses.blocked(state.ip)).toBe(false)
		for (let index = 0; index < 9; index += 1) feedMisses.add(state.ip)
		expect(feedMisses.blocked(state.ip)).toBe(true)
	})

	function interestsForm(token: string, topics: string[]): FormData {
		const data = form({ token, listenerId: '2', id: '2' })
		for (const topic of topics) {
			data.append('topic[]', topic)
			data.append('take[]', topic === 'Security' ? 'Passkeys are ready' : '')
			data.append('note[]', '')
			data.append('active[]', topic === 'Hardware' ? 'false' : 'true')
		}
		return data
	}

	it('saves interests only for the listener the token belongs to', async () => {
		const result = await saveMyInterests(IDLE, interestsForm(ONE, ['Security', 'Hardware']))
		expect(result.status).toBe('saved')
		expect(state.interests).toEqual([
			{
				listenerId: 1,
				rows: [
					{ topic: 'Security', take: 'Passkeys are ready', note: null, active: true },
					{ topic: 'Hardware', take: null, note: null, active: false },
				],
			},
		])
	})

	it('saves no interests for a bad token, a blocked IP or an empty list', async () => {
		for (const token of [REVOKED, 'nope', '']) {
			const result = await saveMyInterests(IDLE, interestsForm(token, ['Security']))
			expect(result.status, token).toBe('error')
		}
		expect(await saveMyInterests(IDLE, interestsForm(ONE, []))).toEqual({
			status: 'error',
			message: 'Keep at least one interest.',
		})
		feedMisses.clear()
		for (let index = 0; index < 10; index += 1) feedMisses.add(state.ip)
		expect(await saveMyInterests(IDLE, interestsForm(ONE, ['Security']))).toEqual({
			status: 'error',
			message: 'Too many attempts. Try again later.',
		})
		expect(state.interests).toEqual([])
	})

	function daysForm(token: string, days: string[]): FormData {
		const data = form({ token, listenerId: '2', id: '2' })
		for (const day of days) data.append('days', day)
		return data
	}

	it('saves days only for the listener the token belongs to', async () => {
		const result = await saveMyDays(IDLE, daysForm(ONE, ['5', '1', '3', '3']))
		expect(result).toEqual({ status: 'saved', message: 'Days saved.' })
		expect(state.days).toEqual([{ listenerId: 1, days: [1, 3, 5] }])
	})

	it('saves no days for a bad token, a blocked IP, no day or a bad day', async () => {
		for (const token of [REVOKED, 'nope', '']) {
			const result = await saveMyDays(IDLE, daysForm(token, ['1']))
			expect(result.status, token).toBe('error')
		}
		expect(await saveMyDays(IDLE, daysForm(ONE, []))).toEqual({
			status: 'error',
			message: 'Pick at least one day.',
		})
		expect((await saveMyDays(IDLE, daysForm(ONE, ['1', '8']))).status).toBe('error')
		feedMisses.clear()
		for (let index = 0; index < 10; index += 1) feedMisses.add(state.ip)
		expect(await saveMyDays(IDLE, daysForm(ONE, ['1']))).toEqual({
			status: 'error',
			message: 'Too many attempts. Try again later.',
		})
		expect(state.days).toEqual([])
	})
})
