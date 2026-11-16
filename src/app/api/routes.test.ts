import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedMisses } from '@/lib/feed-access'
import { hashFeedToken } from '@/lib/feed-tokens'
import { jobFailures } from '@/lib/job-auth'
import { isServed } from '@/lib/served'
import { SESSION_COOKIE, signingKey, signSession } from '@/lib/session'
import { GET as audio, HEAD as audioHead } from './audio/[token]/[file]/route'
import { GET as feed } from './feed/[token]/route'
import { GET as due } from './jobs/due/route'
import { POST as episodes } from './jobs/episodes/route'
import { POST as failures } from './jobs/failures/route'
import { POST as upload } from './jobs/upload/route'

const STORE = 'abc123'
const AUDIO_ONE = `https://${STORE}.private.blob.vercel-storage.com/episodes/1/2026-11-16-x1.mp3`
const AUDIO_TWO = `https://${STORE}.private.blob.vercel-storage.com/episodes/2/2026-11-16-y2.mp3`

const state = vi.hoisted(() => ({
	tokens: new Map<string, { id: number; listenerId: number }>(),
	listeners: [] as {
		id: number
		name: string
		email: string | null
		timezone: string
		stack: { name: string; ecosystem: string }[]
		focus: string
		minutes: number
		days: number[]
		active: boolean
		comped: boolean
		subscription_status: string | null
	}[],
	episodes: [] as { id: number; listenerId: number; date: string; audioUrl: string }[],
	saved: [] as unknown[],
	deleted: [] as string[],
	downloads: [] as { episodeId: number; tokenId: number }[],
	fetches: [] as number[],
	runs: [] as unknown[],
	oldAudioUrl: null as string | null,
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('@/lib/store/feed-tokens', () => ({
	findServedFeedToken: async (hash: string) => {
		const token = state.tokens.get(hash)
		const owner = state.listeners.find((listener) => listener.id === token?.listenerId)
		return token && owner && isServed(owner) ? token : null
	},
	recordFeedFetch: async (id: number) => {
		state.fetches.push(id)
	},
}))
vi.mock('@/lib/store/listeners', () => ({
	listServedListeners: async () => state.listeners.filter(isServed),
	getListener: async (id: number) => state.listeners.find((listener) => listener.id === id) ?? null,
	listenerExists: async (id: number) => state.listeners.some((listener) => listener.id === id),
}))
vi.mock('@/lib/store/interests', () => ({
	activeInterests: async (listenerIds: number[]) =>
		new Map(
			listenerIds.map((id) => [
				id,
				id === 1
					? [
							{ topic: 'AI models and agents', take: 'Agents are overhyped', note: null },
							{ topic: 'Open source', take: null, note: 'Licensing fights' },
						]
					: [],
			])
		),
}))
vi.mock('@/lib/store/episodes', () => ({
	existingEpisodeKeys: async (pairs: { listenerId: number; date: string }[]) =>
		new Set(
			pairs
				.filter((pair) =>
					state.episodes.some(
						(episode) => episode.listenerId === pair.listenerId && episode.date === pair.date
					)
				)
				.map((pair) => `${pair.listenerId}:${pair.date}`)
		),
	lastEpisodeDates: async (pairs: { listenerId: number; date: string }[]) =>
		new Map(
			pairs.flatMap((pair) => {
				const dates = state.episodes
					.filter((episode) => episode.listenerId === pair.listenerId && episode.date < pair.date)
					.map((episode) => episode.date)
					.sort()
				const last = dates.at(-1)
				return last ? [[pair.listenerId, last] as const] : []
			})
		),
	recentEpisodes: async () => [
		{
			date: '2026-11-13',
			title: 'Friday',
			segments: [{ heading: 'h', packages: ['next'], urls: [] }],
		},
	],
	recentFeedbackNotes: async () => [{ date: '2026-11-13', note: 'More Rust' }],
	listFeedEpisodes: async (listenerId: number) =>
		state.episodes
			.filter((episode) => episode.listenerId === listenerId)
			.map((episode) => ({
				id: episode.id,
				published_on: episode.date,
				title: `Episode ${episode.id}`,
				summary: 'Summary',
				segments: [],
				audio_url: episode.audioUrl,
				audio_bytes: 100,
				duration_seconds: 60,
			})),
	listenerEpisodeAudio: async (listenerId: number, episodeId: number) =>
		state.episodes.find((episode) => episode.id === episodeId && episode.listenerId === listenerId)
			?.audioUrl ?? null,
	recordDownload: async (episodeId: number, tokenId: number) => {
		state.downloads.push({ episodeId, tokenId })
	},
	upsertEpisode: async (body: unknown) => {
		state.saved.push(body)
		return { id: 9, replaced: state.oldAudioUrl !== null, oldAudioUrl: state.oldAudioUrl }
	},
}))
vi.mock('@/lib/store/work-context', () => ({
	activeWorkContext: async (listenerIds: number[]) =>
		new Map(
			listenerIds.map((id) => [
				id,
				id === 1
					? [
							{
								project: 'acme/api',
								packages: ['npm:hono'],
								topics: ['Edge caching'],
								summary: 'Moving to edge functions',
								updatedAt: '2026-11-15T10:00:00Z',
							},
						]
					: [],
			])
		),
}))
vi.mock('@/lib/store/runs', () => ({
	recordRunOk: async (...args: unknown[]) => {
		state.runs.push(['ok', ...args])
	},
	recordRunFailure: async (failure: unknown) => {
		state.runs.push(['fail', failure])
	},
}))
vi.mock('@/lib/blob', () => ({
	blobConfigured: () => Boolean(process.env['BLOB_READ_WRITE_TOKEN']),
	audioUploadToken: async (listenerId: number, date: string) => ({
		pathname: `episodes/${listenerId}/${date}.mp3`,
		clientToken: 'client-token',
	}),
	deleteAudio: async (url: string) => {
		state.deleted.push(url)
	},
	signedAudioUrl: async (url: string, operation: string) => `${url}?signed=${operation}`,
}))

const JOB = 'job-token-'.padEnd(48, 'j')
const FEED_ONE = '1'.repeat(64)
const FEED_TWO = '2'.repeat(64)
const REVOKED = '3'.repeat(64)
const BASE = 'http://localhost'

function request(
	path: string,
	init: { method?: string; auth?: string; body?: unknown; raw?: string; cookie?: string } = {}
): Request {
	const headers = new Headers({
		'content-type': 'application/json',
		'x-forwarded-for': '192.0.2.9',
	})
	if (init.auth) headers.set('authorization', init.auth)
	if (init.cookie) headers.set('cookie', init.cookie)
	return new Request(`${BASE}${path}`, {
		method: init.method ?? 'GET',
		headers,
		body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
	})
}

const bearer = `Bearer ${JOB}`

function tokenParams(token: string) {
	return { params: Promise.resolve({ token }) }
}

function audioParams(token: string, file: string) {
	return { params: Promise.resolve({ token, file }) }
}

const script = {
	title: 'Monday',
	summary: 'Things changed.',
	storyCount: 3,
	segments: [
		{
			heading: 'Next 16.5',
			kind: 'news',
			challenges: null,
			topics: ['Developer tools and web development'],
			packages: ['next'],
			sources: [{ title: 'Notes', url: 'https://nextjs.org/blog' }],
		},
	],
	turns: [{ speaker: 'host', text: 'Morning.' }],
}

const episodeBody = {
	...script,
	listenerId: 1,
	date: '2026-11-16',
	metrics: {
		model: 'claude-sonnet-5-5',
		inputTokens: 10,
		outputTokens: 5,
		webSearches: 1,
		webFetches: 2,
		ttsCharacters: 100,
		llmCostUsd: 0.1,
		ttsCostUsd: 0.05,
		researchSeconds: 30,
	},
	audioUrl: AUDIO_ONE,
	audioBytes: 1000,
	durationSeconds: 60,
}

function reset() {
	vi.stubEnv('DIFFCAST_JOB_TOKEN', JOB)
	vi.stubEnv('BLOB_READ_WRITE_TOKEN', `vercel_blob_rw_${STORE}_secret`)
	vi.stubEnv('DIFFCAST_ADMIN_PASSWORD', 'owner-password')
	vi.stubEnv('DIFFCAST_SESSION_SECRET', 's'.repeat(40))
	jobFailures.clear()
	feedMisses.clear()
	state.tokens = new Map([
		[hashFeedToken(FEED_ONE), { id: 11, listenerId: 1 }],
		[hashFeedToken(FEED_TWO), { id: 22, listenerId: 2 }],
	])
	state.listeners = [
		{
			id: 1,
			name: 'Ana',
			email: null,
			timezone: 'America/Los_Angeles',
			stack: [{ name: 'next', ecosystem: 'npm' }],
			focus: 'APIs',
			minutes: 10,
			days: [1, 2, 3, 4, 5, 6, 7],
			active: true,
			comped: true,
			subscription_status: null,
		},
		{
			id: 2,
			name: 'Bo',
			email: null,
			timezone: 'Asia/Tokyo',
			stack: [],
			focus: '',
			minutes: 8,
			days: [1, 2, 3, 4, 5],
			active: true,
			comped: false,
			subscription_status: 'active',
		},
		{
			id: 3,
			name: 'Cy',
			email: null,
			timezone: 'America/Los_Angeles',
			stack: [],
			focus: '',
			minutes: 10,
			days: [1, 2, 3, 4, 5, 6, 7],
			active: false,
			comped: true,
			subscription_status: null,
		},
	]
	state.episodes = [
		{ id: 101, listenerId: 1, date: '2026-11-13', audioUrl: AUDIO_ONE },
		{ id: 202, listenerId: 2, date: '2026-11-16', audioUrl: AUDIO_TWO },
	]
	state.saved.length = 0
	state.deleted.length = 0
	state.downloads.length = 0
	state.fetches.length = 0
	state.runs.length = 0
	state.oldAudioUrl = null
}

afterAll(() => {
	vi.unstubAllEnvs()
})

describe('job api auth', () => {
	beforeEach(reset)

	it('answers 401 on every route without a token, with a wrong one or with only the admin cookie', async () => {
		const key = signingKey('s'.repeat(40), 'owner-password')
		const cookie = `${SESSION_COOKIE}=${signSession(key)}`
		const cases = [undefined, `Bearer ${'x'.repeat(48)}`, `Basic ${JOB}`, JOB]
		const responses = await Promise.all([
			...cases.map((auth) => due(request('/api/jobs/due', { auth }))),
			due(request('/api/jobs/due', { cookie })),
			upload(request('/api/jobs/upload', { method: 'POST', body: {} })),
			episodes(request('/api/jobs/episodes', { method: 'POST', body: episodeBody })),
			failures(request('/api/jobs/failures', { method: 'POST', body: {} })),
		])
		expect(responses.map((response) => response.status)).toEqual(Array(8).fill(401))
		expect(state.saved).toEqual([])
		expect(state.runs).toEqual([])
	})

	it('answers 401 to everything when the configured token is under 32 characters', async () => {
		vi.stubEnv('DIFFCAST_JOB_TOKEN', 'short-token')
		const response = await due(request('/api/jobs/due', { auth: 'Bearer short-token' }))
		expect(response.status).toBe(401)
		vi.stubEnv('DIFFCAST_JOB_TOKEN', '')
		expect((await due(request('/api/jobs/due', { auth: 'Bearer ' }))).status).toBe(401)
	})

	it('throttles an IP after repeated failures with 429', async () => {
		const responses = await Promise.all(
			Array.from({ length: 11 }, () => due(request('/api/jobs/due', { auth: 'Bearer nope' })))
		)
		expect(responses.filter((response) => response.status === 429).length).toBeGreaterThan(0)
	})

	it('accepts the bearer token on every route', async () => {
		const authed = await Promise.all([
			due(request('/api/jobs/due', { auth: bearer })),
			upload(
				request('/api/jobs/upload', {
					method: 'POST',
					auth: bearer,
					body: { listenerId: 1, date: '2026-11-16' },
				})
			),
			episodes(request('/api/jobs/episodes', { method: 'POST', auth: bearer, body: episodeBody })),
			failures(
				request('/api/jobs/failures', {
					method: 'POST',
					auth: bearer,
					body: { listenerId: 1, date: '2026-11-16', step: 'tts', message: 'x' },
				})
			),
		])
		expect(authed.map((response) => response.status)).toEqual([200, 200, 200, 200])
	})
})

describe('job api bodies', () => {
	beforeEach(reset)

	it('lists due listeners with interests, recent episodes and feedback', async () => {
		const response = await due(request('/api/jobs/due?now=2026-11-16T12:00:00Z', { auth: bearer }))
		expect(response.status).toBe(200)
		const body = (await response.json()) as { listeners: { listenerId: number; date: string }[] }
		expect(body.listeners).toEqual([
			{
				listenerId: 1,
				date: '2026-11-16',
				format: 'daily',
				since: '2026-11-13',
				timezone: 'America/Los_Angeles',
				minutes: 10,
				stack: [{ name: 'next', ecosystem: 'npm' }],
				focus: 'APIs',
				interests: [
					{ topic: 'AI models and agents', take: 'Agents are overhyped', note: null },
					{ topic: 'Open source', take: null, note: 'Licensing fights' },
				],
				recent: [
					{
						date: '2026-11-13',
						title: 'Friday',
						segments: [{ heading: 'h', packages: ['next'], urls: [] }],
					},
				],
				feedback: [{ date: '2026-11-13', note: 'More Rust' }],
				workContext: [
					{
						project: 'acme/api',
						packages: ['npm:hono'],
						topics: ['Edge caching'],
						summary: 'Moving to edge functions',
						updatedAt: '2026-11-15T10:00:00Z',
					},
				],
			},
		])
		const tokyo = await due(request('/api/jobs/due?now=2026-11-16T19:00:00Z', { auth: bearer }))
		expect(
			((await tokyo.json()) as { listeners: { listenerId: number; date: string }[] }).listeners.map(
				(entry) => [entry.listenerId, entry.date]
			)
		).toEqual([[2, '2026-11-17']])
		const saturday = await due(request('/api/jobs/due?now=2026-11-21T12:00:00Z', { auth: bearer }))
		expect(
			(
				(await saturday.json()) as {
					listeners: { listenerId: number; format: string; since: string | null }[]
				}
			).listeners.map((entry) => [entry.listenerId, entry.format, entry.since])
		).toEqual([[1, 'weekly_recap', '2026-11-13']])
		state.episodes = []
		const sunday = await due(request('/api/jobs/due?now=2026-11-22T12:00:00Z', { auth: bearer }))
		expect(
			(
				(await sunday.json()) as {
					listeners: { listenerId: number; format: string; since: string | null }[]
				}
			).listeners.map((entry) => [entry.listenerId, entry.format, entry.since])
		).toEqual([[1, 'week_ahead', null]])
		expect((await due(request('/api/jobs/due?now=yesterday', { auth: bearer }))).status).toBe(400)
	})

	it('skips a listener whose episode for the day exists', async () => {
		state.episodes.push({ id: 103, listenerId: 1, date: '2026-11-16', audioUrl: AUDIO_ONE })
		const response = await due(request('/api/jobs/due?now=2026-11-16T12:00:00Z', { auth: bearer }))
		expect(((await response.json()) as { listeners: unknown[] }).listeners).toEqual([])
	})

	it('mints an upload token for the listener folder, 503 without Blob, 404 for an unknown listener', async () => {
		const ok = await upload(
			request('/api/jobs/upload', {
				method: 'POST',
				auth: bearer,
				body: { listenerId: 1, date: '2026-11-16' },
			})
		)
		expect(await ok.json()).toEqual({
			pathname: 'episodes/1/2026-11-16.mp3',
			clientToken: 'client-token',
		})
		const bad = await upload(
			request('/api/jobs/upload', {
				method: 'POST',
				auth: bearer,
				body: { listenerId: 1, date: '../x' },
			})
		)
		expect(bad.status).toBe(400)
		expect(((await bad.json()) as { issues: unknown[] }).issues.length).toBeGreaterThan(0)
		const unknown = await upload(
			request('/api/jobs/upload', {
				method: 'POST',
				auth: bearer,
				body: { listenerId: 99, date: '2026-11-16' },
			})
		)
		expect(unknown.status).toBe(404)
		vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
		const missing = await upload(
			request('/api/jobs/upload', {
				method: 'POST',
				auth: bearer,
				body: { listenerId: 1, date: '2026-11-16' },
			})
		)
		expect(missing.status).toBe(503)
	})

	it('saves an episode, records the run and deletes replaced audio', async () => {
		state.oldAudioUrl = `https://${STORE}.private.blob.vercel-storage.com/episodes/1/2026-11-16-old.mp3`
		const response = await episodes(
			request('/api/jobs/episodes', { method: 'POST', auth: bearer, body: episodeBody })
		)
		expect(await response.json()).toEqual({ id: 9, replaced: true })
		expect(state.deleted).toEqual([state.oldAudioUrl])
		expect(state.runs).toEqual([['ok', 1, '2026-11-16', 'replaced']])
	})

	it('keeps the audio when a rerun sends the same url', async () => {
		state.oldAudioUrl = AUDIO_ONE
		await episodes(
			request('/api/jobs/episodes', { method: 'POST', auth: bearer, body: episodeBody })
		)
		expect(state.deleted).toEqual([])
	})

	it('rejects audio outside the listener folder or store, and invalid bodies', async () => {
		const bodies = [
			{ ...episodeBody, audioUrl: AUDIO_TWO },
			{ ...episodeBody, audioUrl: 'https://evil.example.com/episodes/1/a.mp3' },
			{ ...episodeBody, segments: [{ ...script.segments[0], sources: [] }] },
			{ ...episodeBody, turns: [{ speaker: 'guest', text: 'hi' }] },
		]
		const responses = await Promise.all(
			bodies.map((body) =>
				episodes(request('/api/jobs/episodes', { method: 'POST', auth: bearer, body }))
			)
		)
		expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400])
		const raw = await episodes(
			request('/api/jobs/episodes', { method: 'POST', auth: bearer, raw: '{' })
		)
		expect(raw.status).toBe(400)
		expect(state.saved).toEqual([])
	})

	it('records a failure', async () => {
		const failure = { listenerId: 2, date: '2026-11-16', step: 'research', message: 'timeout' }
		const response = await failures(
			request('/api/jobs/failures', { method: 'POST', auth: bearer, body: failure })
		)
		expect(response.status).toBe(200)
		expect(state.runs).toEqual([['fail', failure]])
		const bad = await failures(
			request('/api/jobs/failures', {
				method: 'POST',
				auth: bearer,
				body: { ...failure, step: 'lunch' },
			})
		)
		expect(bad.status).toBe(400)
	})
})

describe('feed and audio', () => {
	beforeEach(reset)

	it('serves the listener their own feed and records the fetch', async () => {
		const response = await feed(request(`/api/feed/${FEED_ONE}`), tokenParams(FEED_ONE))
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('private, max-age=300')
		const xml = await response.text()
		expect(xml).toContain('<title>Diffcast for Ana</title>')
		expect(xml).toContain(`/api/audio/${FEED_ONE}/101.mp3`)
		expect(xml).not.toContain('202.mp3')
		expect(xml).not.toContain('blob.vercel-storage.com')
		expect(state.fetches).toEqual([11])
	})

	it('answers 404 to a revoked, unknown or malformed token', async () => {
		const responses = await Promise.all(
			[REVOKED, 'f'.repeat(64), 'short', '../x'].map((token) =>
				feed(request(`/api/feed/${token}`), tokenParams(token))
			)
		)
		expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
		const revokedAudio = await audio(
			request(`/api/audio/${REVOKED}/101.mp3`),
			audioParams(REVOKED, '101.mp3')
		)
		expect(revokedAudio.status).toBe(404)
		expect(state.fetches).toEqual([])
	})

	it('redirects to a signed url and records a GET download', async () => {
		const response = await audio(
			request(`/api/audio/${FEED_ONE}/101.mp3`),
			audioParams(FEED_ONE, '101.mp3')
		)
		expect(response.status).toBe(302)
		expect(response.headers.get('location')).toBe(`${AUDIO_ONE}?signed=get`)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(response.headers.get('referrer-policy')).toBe('no-referrer')
		expect(state.downloads).toEqual([{ episodeId: 101, tokenId: 11 }])
		const head = await audioHead(
			request(`/api/audio/${FEED_ONE}/101.mp3`, { method: 'HEAD' }),
			audioParams(FEED_ONE, '101.mp3')
		)
		expect(head.headers.get('location')).toBe(`${AUDIO_ONE}?signed=head`)
		expect(state.downloads).toHaveLength(1)
	})

	it("answers 404 for another listener's episode and records nothing", async () => {
		const response = await audio(
			request(`/api/audio/${FEED_ONE}/202.mp3`),
			audioParams(FEED_ONE, '202.mp3')
		)
		expect(response.status).toBe(404)
		expect(response.headers.get('location')).toBeNull()
		expect(await response.text()).not.toContain('blob')
		const head = await audioHead(
			request(`/api/audio/${FEED_ONE}/202.mp3`, { method: 'HEAD' }),
			audioParams(FEED_ONE, '202.mp3')
		)
		expect(head.status).toBe(404)
		const own = await audio(
			request(`/api/audio/${FEED_TWO}/202.mp3`),
			audioParams(FEED_TWO, '202.mp3')
		)
		expect(own.status).toBe(302)
		expect(state.downloads).toEqual([{ episodeId: 202, tokenId: 22 }])
		const badFile = await audio(
			request(`/api/audio/${FEED_ONE}/101.wav`),
			audioParams(FEED_ONE, '101.wav')
		)
		expect(badFile.status).toBe(404)
	})

	it("stops a deactivated listener's feed and audio with 404", async () => {
		const ana = state.listeners.find((listener) => listener.id === 1)
		if (!ana) throw new Error('fixture')
		ana.active = false
		const [feedResponse, audioResponse] = await Promise.all([
			feed(request(`/api/feed/${FEED_ONE}`), tokenParams(FEED_ONE)),
			audio(request(`/api/audio/${FEED_ONE}/101.mp3`), audioParams(FEED_ONE, '101.mp3')),
		])
		expect([feedResponse.status, audioResponse.status]).toEqual([404, 404])
		expect(state.fetches).toEqual([])
		expect(state.downloads).toEqual([])
		const other = await feed(request(`/api/feed/${FEED_TWO}`), tokenParams(FEED_TWO))
		expect(other.status).toBe(200)
	})

	it('stops a canceled or unpaid subscriber and keeps serving one past due', async () => {
		const bo = state.listeners.find((listener) => listener.id === 2)
		if (!bo) throw new Error('fixture')
		for (const [status, expected] of [
			['canceled', 404],
			['unpaid', 404],
			['incomplete', 404],
			['past_due', 200],
			['active', 200],
		] as const) {
			feedMisses.clear()
			bo.subscription_status = status
			const response = await feed(request(`/api/feed/${FEED_TWO}`), tokenParams(FEED_TWO))
			expect(response.status, status).toBe(expected)
		}
		bo.subscription_status = 'canceled'
		const tokyo = await due(request('/api/jobs/due?now=2026-11-16T19:00:00Z', { auth: bearer }))
		expect(((await tokyo.json()) as { listeners: unknown[] }).listeners).toEqual([])
	})
})
