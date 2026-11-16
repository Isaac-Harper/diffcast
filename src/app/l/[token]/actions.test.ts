import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashFeedToken } from '@/lib/feed-tokens'
import { submitFeedback, submitSurvey } from './actions'

const state = vi.hoisted(() => ({
	tokens: new Map<string, { id: number; listenerId: number }>(),
	feedback: [] as { episodeId: number; input: unknown }[],
	surveys: [] as { listenerId: number; input: unknown }[],
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('next/cache', () => ({ refresh: () => undefined }))
vi.mock('@/lib/store/feed-tokens', () => ({
	findActiveFeedToken: async (hash: string) => state.tokens.get(hash) ?? null,
}))
vi.mock('@/lib/store/episodes', () => ({
	listenerOwnsEpisode: async (listenerId: number, episodeId: number) =>
		(listenerId === 1 && episodeId === 101) || (listenerId === 2 && episodeId === 202),
}))
vi.mock('@/lib/store/feedback', () => ({
	addFeedback: async (episodeId: number, input: unknown) => {
		state.feedback.push({ episodeId, input })
	},
	addSurvey: async (listenerId: number, input: unknown) => {
		state.surveys.push({ listenerId, input })
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
		state.surveys.length = 0
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
		const survey = await submitSurvey(IDLE, form({ token: REVOKED, wouldPay: 'yes' }))
		expect(survey.status).toBe('error')
		expect(state.feedback).toEqual([])
		expect(state.surveys).toEqual([])
	})

	it('saves the survey for the token listener', async () => {
		const result = await submitSurvey(IDLE, form({ token: ONE, wouldPay: 'maybe', note: 'At $10' }))
		expect(result.status).toBe('saved')
		expect(state.surveys).toEqual([{ listenerId: 1, input: { wouldPay: 'maybe', note: 'At $10' } }])
	})
})
