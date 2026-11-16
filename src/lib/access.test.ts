import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkFeedToken, feedAccess, feedMisses } from './feed-access'
import { hashFeedToken } from './feed-tokens'
import { checkJobRequest, jobFailures } from './job-auth'

const state = vi.hoisted(() => ({
	tokens: new Map<string, { id: number; listenerId: number }>(),
	queries: [] as string[],
}))

vi.mock('./db', () => ({
	sql: (strings: TemplateStringsArray) => {
		state.queries.push(strings.join('?'))
		return Promise.resolve([])
	},
}))
vi.mock('./store/feed-tokens', async (importOriginal) => {
	const original = await importOriginal<typeof import('./store/feed-tokens')>()
	return {
		...original,
		findServedFeedToken: async (hash: string) => state.tokens.get(hash) ?? null,
	}
})

const VALID = '1'.repeat(64)
const JOB = 'job-token-'.padEnd(48, 'j')
const IP = '198.51.100.7'

function request(auth?: string): Request {
	const headers = new Headers({ 'x-forwarded-for': IP })
	if (auth) headers.set('authorization', auth)
	return new Request('http://localhost/api/x', { headers })
}

function fill(throttle: { add: (key: string) => void }, count: number) {
	for (let index = 0; index < count; index += 1) throttle.add(IP)
}

beforeEach(() => {
	vi.stubEnv('DIFFCAST_JOB_TOKEN', JOB)
	feedMisses.clear()
	jobFailures.clear()
	state.tokens = new Map([[hashFeedToken(VALID), { id: 1, listenerId: 1 }]])
	state.queries.length = 0
})

describe('feed miss throttle', () => {
	it('blocks a valid token from an IP that kept missing, without a lookup', async () => {
		fill(feedMisses, 10)
		const lookups = vi.spyOn(state.tokens, 'get')
		const response = await checkFeedToken(request(), VALID)
		expect(response).toBeInstanceOf(Response)
		expect((response as Response).status).toBe(429)
		expect(lookups).not.toHaveBeenCalled()
	})

	it('still delays a blocked answer', async () => {
		fill(feedMisses, 10)
		const started = Date.now()
		expect(await feedAccess(IP, VALID, 60)).toBe(429)
		expect(Date.now() - started).toBeGreaterThanOrEqual(55)
	})

	it('counts misses up to the block and lets a valid token through before it', async () => {
		expect(await feedAccess(IP, VALID, 0)).toEqual({ id: 1, listenerId: 1 })
		for (let index = 0; index < 10; index += 1) {
			expect(await feedAccess(IP, '2'.repeat(64), 0)).toBe(404)
		}
		expect(await feedAccess(IP, '2'.repeat(64), 0)).toBe(429)
		expect(await feedAccess(IP, VALID, 0)).toBe(429)
		expect(await feedAccess('203.0.113.1', VALID, 0)).toEqual({ id: 1, listenerId: 1 })
	})
})

describe('job auth throttle', () => {
	it('blocks even the right token from a blocked IP, with the delay', async () => {
		fill(jobFailures, 10)
		const started = Date.now()
		const response = await checkJobRequest(request(`Bearer ${JOB}`), { delayMs: 60 })
		expect(response?.status).toBe(429)
		expect(Date.now() - started).toBeGreaterThanOrEqual(55)
	})

	it('accepts the right token from an IP below the limit', async () => {
		fill(jobFailures, 9)
		expect(await checkJobRequest(request(`Bearer ${JOB}`), { delayMs: 0 })).toBeNull()
	})
})

describe('served listeners', () => {
	it('only finds tokens of served listeners', async () => {
		const { findServedFeedToken } =
			await vi.importActual<typeof import('./store/feed-tokens')>('./store/feed-tokens')
		await findServedFeedToken('hash')
		expect(state.queries).toHaveLength(2)
		expect(state.queries).toContainEqual(
			expect.stringMatching(/^\(l\.active AND \(l\.comped OR l\.subscription_status = ANY\(/)
		)
		expect(state.queries).toContainEqual(expect.stringMatching(/revoked_at IS NULL AND \?$/m))
	})
})
