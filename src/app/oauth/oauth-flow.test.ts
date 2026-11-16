import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LISTENER_COOKIE, listenerSigningKey, signListenerSession } from '@/lib/listener-session'
import { s256Challenge } from '@/lib/oauth/secrets'
import { mcpCalls, registrations, tokenAttempts } from '@/lib/oauth/throttles'
import { isServed } from '@/lib/served'
import { GET as authorizationServer } from '../.well-known/oauth-authorization-server/route'
import { GET as protectedResourcePath } from '../.well-known/oauth-protected-resource/api/mcp/route'
import { GET as protectedResource } from '../.well-known/oauth-protected-resource/route'
import { POST as mcp } from '../api/mcp/route'
import { decideAuthorization } from './authorize/actions'
import { POST as register } from './register/route'
import { POST as revoke } from './revoke/route'
import { POST as token } from './token/route'

const ORIGIN = 'https://diffcast.fm'
const RESOURCE = `${ORIGIN}/api/mcp`
const REDIRECT = 'http://127.0.0.1:43210/callback'
const VERIFIER = 'a'.repeat(20) + 'b'.repeat(30)

interface FakeListener {
	id: number
	name: string
	email: string
	timezone: string
	stack: never[]
	focus: string
	minutes: number
	days: number[]
	active: boolean
	comped: boolean
	subscription_status: string | null
	current_period_end: null
	stripe_customer_id: null
}

interface FakeToken {
	id: number
	hash: string
	kind: 'access' | 'refresh'
	grantId: number
	expiresAt: number
	revoked: boolean
}

const state = vi.hoisted(() => ({
	now: 0,
	cookie: undefined as string | undefined,
	listeners: new Map<number, FakeListener>(),
	clients: new Map<
		string,
		{ id: string; kind: string; name: string; redirectUris: string[]; cacheUntil: string | null }
	>(),
	codes: [] as {
		id: number
		hash: string
		clientId: string
		listenerId: number
		redirectUri: string
		codeChallenge: string
		resource: string
		scope: string
		expiresAt: number
		used: boolean
		grantId: number | null
	}[],
	grants: [] as {
		id: number
		listenerId: number
		clientId: string
		resource: string
		scope: string
		revoked: boolean
		lastUsed: number
	}[],
	tokens: [] as FakeToken[],
	interests: new Map<
		number,
		{ topic: string; take: string | null; note: string | null; active: boolean }[]
	>(),
	contexts: new Map<
		number,
		{ project: string; packages: string[]; topics: string[]; summary: string }[]
	>(),
	pushes: new Map<number, number>(),
	fetchedDocuments: [] as string[],
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('next/cache', () => ({ refresh: () => undefined }))
vi.mock('next/headers', () => ({
	headers: async () => new Headers({ host: 'diffcast.fm', 'x-forwarded-proto': 'https' }),
	cookies: async () => ({
		get: (name: string) =>
			name === LISTENER_COOKIE && state.cookie ? { name, value: state.cookie } : undefined,
		set: () => undefined,
		delete: () => undefined,
	}),
}))
vi.mock('@/lib/oauth/fetch-metadata-document', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/oauth/fetch-metadata-document')>()),
	fetchMetadataDocument: async (url: string) => {
		state.fetchedDocuments.push(url)
		return {
			body: { client_id: url, client_name: 'Metadata Agent', redirect_uris: [REDIRECT] },
			cacheControl: 'max-age=600',
		}
	},
}))
vi.mock('@/lib/store/listeners', () => ({
	getListener: async (id: number) => state.listeners.get(id) ?? null,
	sessionEpoch: async (id: number) => (state.listeners.has(id) ? 0 : null),
	setListenerDays: async (id: number, days: number[]) => {
		const listener = state.listeners.get(id)
		if (listener) listener.days = days
	},
}))
vi.mock('@/lib/store/interests', () => ({
	listInterests: async (id: number) =>
		(state.interests.get(id) ?? []).map((row, index) => ({ ...row, id: index + 1, sort: index })),
	saveInterests: async (
		id: number,
		rows: { topic: string; take: string | null; note: string | null; active: boolean }[]
	) => {
		state.interests.set(id, rows)
	},
}))
vi.mock('@/lib/store/episodes', () => ({
	listFeedEpisodes: async (id: number, limit: number) =>
		id === 1
			? [
					{
						id: 9,
						published_on: '2026-11-16',
						title: 'Monday diff',
						summary: 'Three things changed.',
						segments: [
							{
								heading: 'Next 16.5',
								kind: 'news',
								challenges: null,
								topics: ['Developer tools'],
								packages: ['next'],
								sources: [{ title: 'Release notes', url: 'https://nextjs.org/blog' }],
							},
						],
						audio_url: 'https://store.private.blob.vercel-storage.com/secret.mp3',
						audio_bytes: 10,
						duration_seconds: 600.4,
					},
				].slice(0, limit)
			: [],
}))
vi.mock('@/lib/store/work-context', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/store/work-context')>()),
	upsertWorkContext: async (
		id: number,
		input: { project: string; packages: string[]; topics: string[]; summary: string }
	) => {
		const list = (state.contexts.get(id) ?? []).filter((entry) => entry.project !== input.project)
		state.contexts.set(id, [input, ...list])
		return { ...input, updatedAt: '2026-11-16 10:00:00+00', expiresAt: '2026-12-16 10:00:00+00' }
	},
	listWorkContext: async (id: number) =>
		(state.contexts.get(id) ?? []).map((entry) => ({ ...entry, updatedAt: 'u', expiresAt: 'e' })),
	clearWorkContext: async (id: number, project: string | null) => {
		const list = state.contexts.get(id) ?? []
		const kept = project === null ? [] : list.filter((entry) => entry.project !== project)
		state.contexts.set(id, kept)
		return list.length - kept.length
	},
	countPush: async (id: number) => {
		const count = state.pushes.get(id) ?? 0
		if (count >= 60) return null
		state.pushes.set(id, count + 1)
		return count + 1
	},
}))
vi.mock('@/lib/store/oauth', () => {
	let nextId = 1
	const grantRow = (id: number) => state.grants.find((grant) => grant.id === id)
	const served = (listenerId: number) => {
		const listener = state.listeners.get(listenerId)
		return listener ? isServed(listener) : false
	}
	const insertTokens = (
		grantId: number,
		tokens: {
			accessHash: string
			accessExpiresAt: Date
			refreshHash: string
			refreshExpiresAt: Date
		}
	) => {
		state.tokens.push(
			{
				id: nextId++,
				hash: tokens.accessHash,
				kind: 'access',
				grantId,
				expiresAt: tokens.accessExpiresAt.getTime(),
				revoked: false,
			},
			{
				id: nextId++,
				hash: tokens.refreshHash,
				kind: 'refresh',
				grantId,
				expiresAt: tokens.refreshExpiresAt.getTime(),
				revoked: false,
			}
		)
	}
	const revokeGrant = async (grantId: number) => {
		const grant = grantRow(grantId)
		if (grant) grant.revoked = true
		for (const row of state.tokens) if (row.grantId === grantId) row.revoked = true
	}
	return {
		addRegisteredClient: async (id: string, name: string, redirectUris: string[]) => {
			state.clients.set(id, { id, kind: 'registered', name, redirectUris, cacheUntil: null })
		},
		getClient: async (id: string) => state.clients.get(id) ?? null,
		saveMetadataClient: async (id: string, name: string, redirectUris: string[]) => {
			state.clients.set(id, {
				id,
				kind: 'metadata_document',
				name,
				redirectUris,
				cacheUntil: 'later',
			})
		},
		addCode: async (input: {
			codeHash: string
			clientId: string
			listenerId: number
			redirectUri: string
			codeChallenge: string
			resource: string
			scope: string
			expiresAt: Date
		}) => {
			state.codes.push({
				id: nextId++,
				hash: input.codeHash,
				clientId: input.clientId,
				listenerId: input.listenerId,
				redirectUri: input.redirectUri,
				codeChallenge: input.codeChallenge,
				resource: input.resource,
				scope: input.scope,
				expiresAt: input.expiresAt.getTime(),
				used: false,
				grantId: null,
			})
		},
		redeemCode: async (input: {
			codeHash: string
			clientId: string
			redirectUri: string
			codeChallenge: string | null
			resource: string
			tokens: Parameters<typeof insertTokens>[1]
		}) => {
			const code = state.codes.find((entry) => entry.hash === input.codeHash)
			if (!code) return { status: 'unknown' }
			if (code.used) return { status: 'reused', grantId: code.grantId }
			code.used = true
			const row = {
				...code,
				expired: code.expiresAt <= Date.now() + state.now,
				served: served(code.listenerId),
			}
			const valid =
				!row.expired &&
				row.served &&
				row.clientId === input.clientId &&
				row.redirectUri === input.redirectUri &&
				row.codeChallenge === input.codeChallenge &&
				row.resource === input.resource
			if (!valid) return { status: 'refused', code: row }
			const id = nextId++
			state.grants.push({
				id,
				listenerId: code.listenerId,
				clientId: code.clientId,
				resource: code.resource,
				scope: code.scope,
				revoked: false,
				lastUsed: 0,
			})
			insertTokens(id, input.tokens)
			code.grantId = id
			return { status: 'redeemed', code: row, grantId: id }
		},
		findRefreshToken: async (hash: string) => {
			const row = state.tokens.find((entry) => entry.hash === hash && entry.kind === 'refresh')
			const grant = row ? grantRow(row.grantId) : undefined
			if (!row || !grant) return null
			return {
				id: row.id,
				grantId: grant.id,
				clientId: grant.clientId,
				resource: grant.resource,
				scope: grant.scope,
				revoked: row.revoked,
				expired: row.expiresAt <= Date.now() + state.now,
				grantRevoked: grant.revoked,
				served: served(grant.listenerId),
			}
		},
		rotateRefreshToken: async (
			tokenId: number,
			grantId: number,
			tokens: Parameters<typeof insertTokens>[1]
		) => {
			const row = state.tokens.find((entry) => entry.id === tokenId)
			if (!row || row.revoked) return false
			row.revoked = true
			insertTokens(grantId, tokens)
			return true
		},
		revokeGrant,
		revokeToken: async (hash: string, clientId: string) => {
			const row = state.tokens.find((entry) => entry.hash === hash)
			const grant = row ? grantRow(row.grantId) : undefined
			if (!row || !grant || grant.clientId !== clientId) return null
			row.revoked = true
			return { kind: row.kind, grantId: grant.id }
		},
		findAccessToken: async (hash: string) => {
			const row = state.tokens.find((entry) => entry.hash === hash && entry.kind === 'access')
			const grant = row ? grantRow(row.grantId) : undefined
			if (!row || !grant || row.revoked || grant.revoked || row.expiresAt <= Date.now() + state.now)
				return null
			return {
				grantId: grant.id,
				listenerId: grant.listenerId,
				clientId: grant.clientId,
				resource: grant.resource,
				scope: grant.scope,
				expiresAt: row.expiresAt / 1000,
			}
		},
		touchGrant: async (grantId: number) => {
			const grant = grantRow(grantId)
			if (grant) grant.lastUsed += 1
		},
	}
})

function listener(id: number, overrides: Partial<FakeListener> = {}): FakeListener {
	return {
		id,
		name: `Listener ${id}`,
		email: `l${id}@example.com`,
		timezone: 'Europe/Berlin',
		stack: [],
		focus: '',
		minutes: 10,
		days: [1, 2, 3, 4, 5, 6, 7],
		active: true,
		comped: true,
		subscription_status: null,
		current_period_end: null,
		stripe_customer_id: null,
		...overrides,
	}
}

function request(
	path: string,
	init: RequestInit & { form?: Record<string, string>; json?: unknown } = {}
): Request {
	const headers = new Headers(init.headers)
	headers.set('host', 'diffcast.fm')
	headers.set('x-forwarded-host', 'diffcast.fm')
	headers.set('x-forwarded-proto', 'https')
	headers.set('x-forwarded-for', '198.51.100.20')
	let body = init.body
	if (init.form) {
		headers.set('content-type', 'application/x-www-form-urlencoded')
		body = new URLSearchParams(init.form).toString()
	}
	if (init.json !== undefined) {
		headers.set('content-type', 'application/json')
		body = JSON.stringify(init.json)
	}
	return new Request(`${ORIGIN}${path}`, { ...init, headers, body })
}

async function registerClient(redirectUris: string[] = [REDIRECT]): Promise<string> {
	const response = await register(
		request('/oauth/register', {
			method: 'POST',
			json: { client_name: 'Test Agent', redirect_uris: redirectUris },
		})
	)
	expect(response.status).toBe(201)
	return ((await response.json()) as { client_id: string }).client_id
}

function authorizeQuery(clientId: string, overrides: Record<string, string> = {}): string {
	return new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT,
		response_type: 'code',
		code_challenge: s256Challenge(VERIFIER),
		code_challenge_method: 'S256',
		state: 'state-123',
		resource: RESOURCE,
		scope: 'diffcast',
		...overrides,
	}).toString()
}

async function decide(query: string, decision: 'allow' | 'deny' = 'allow'): Promise<URL> {
	const form = new FormData()
	form.set('query', query)
	form.set('decision', decision)
	try {
		await decideAuthorization(form)
	} catch (error) {
		const digest = (error as { digest?: string }).digest ?? ''
		const location = digest.split(';')[2]
		if (!digest.startsWith('NEXT_REDIRECT') || !location) throw error
		return new URL(location, ORIGIN)
	}
	throw new Error('decideAuthorization did not redirect')
}

async function authorizeCode(
	clientId: string,
	overrides: Record<string, string> = {}
): Promise<string> {
	const url = await decide(authorizeQuery(clientId, overrides))
	const code = url.searchParams.get('code')
	if (!code) throw new Error(`no code in ${url.toString()}`)
	return code
}

async function exchange(form: Record<string, string>) {
	const response = await token(request('/oauth/token', { method: 'POST', form }))
	return {
		status: response.status,
		body: (await response.json()) as Record<string, string | number>,
		headers: response.headers,
	}
}

async function connect(clientId: string) {
	const code = await authorizeCode(clientId)
	const tokens = await exchange({
		grant_type: 'authorization_code',
		code,
		code_verifier: VERIFIER,
		client_id: clientId,
		redirect_uri: REDIRECT,
		resource: RESOURCE,
	})
	expect(tokens.status).toBe(200)
	return tokens.body as { access_token: string; refresh_token: string }
}

async function mcpClient(accessToken: string) {
	const client = new Client({ name: 'diffcast-test', version: '1.0.0' })
	const transport = new StreamableHTTPClientTransport(new URL(RESOURCE), {
		fetch: async (input, init) => {
			const headers = new Headers(init?.headers)
			headers.set('authorization', `Bearer ${accessToken}`)
			const path = new URL(String(input)).pathname
			return mcp(request(path, { ...init, method: init?.method ?? 'POST', headers }))
		},
	})
	await client.connect(transport)
	return client
}

beforeEach(() => {
	vi.stubEnv('DIFFCAST_SESSION_SECRET', 's'.repeat(40))
	state.now = 0
	state.listeners = new Map([
		[1, listener(1)],
		[2, listener(2, { comped: false, subscription_status: 'canceled' })],
	])
	state.clients = new Map()
	state.codes = []
	state.grants = []
	state.tokens = []
	state.interests = new Map([
		[1, [{ topic: 'Security and privacy', take: null, note: null, active: true }]],
	])
	state.contexts = new Map()
	state.pushes = new Map()
	state.fetchedDocuments = []
	state.cookie = signListenerSession({ listenerId: 1, epoch: 0 }, listenerSigningKey())
	registrations.clear()
	tokenAttempts.clear()
	mcpCalls.clear()
})

describe('discovery', () => {
	it('answers an unauthenticated MCP request with 401 and the resource metadata challenge', async () => {
		const response = await mcp(
			request('/api/mcp', { method: 'POST', json: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })
		)
		expect(response.status).toBe(401)
		const challenge = response.headers.get('www-authenticate') ?? ''
		expect(challenge).toMatch(/^Bearer /)
		expect(challenge).toContain(
			'resource_metadata="https://diffcast.fm/.well-known/oauth-protected-resource"'
		)
		const bad = await mcp(
			request('/api/mcp', {
				method: 'POST',
				headers: { authorization: `Bearer ${'x'.repeat(43)}` },
				json: {},
			})
		)
		expect(bad.status).toBe(401)
	})

	it('serves protected resource metadata at the root and path suffixed locations, and AS metadata', async () => {
		for (const handler of [protectedResource, protectedResourcePath]) {
			const body = (await handler(
				request('/.well-known/oauth-protected-resource')
			).json()) as Record<string, unknown>
			expect(body).toMatchObject({ resource: RESOURCE, authorization_servers: [ORIGIN] })
		}
		const server = (await authorizationServer(
			request('/.well-known/oauth-authorization-server')
		).json()) as Record<string, unknown>
		expect(server['issuer']).toBe(ORIGIN)
		expect(server['code_challenge_methods_supported']).toEqual(['S256'])
	})
})

describe('registration', () => {
	it('registers public clients and refuses bad redirects, confidential clients and floods', async () => {
		const id = await registerClient()
		expect(state.clients.get(id)).toMatchObject({ name: 'Test Agent', redirectUris: [REDIRECT] })
		const bad = await register(
			request('/oauth/register', {
				method: 'POST',
				json: { redirect_uris: ['http://evil.example/cb'] },
			})
		)
		expect([bad.status, ((await bad.json()) as { error: string }).error]).toEqual([
			400,
			'invalid_redirect_uri',
		])
		const secret = await register(
			request('/oauth/register', {
				method: 'POST',
				json: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'client_secret_post' },
			})
		)
		expect(secret.status).toBe(400)
		for (let index = 0; index < 10; index += 1) registrations.add('198.51.100.20')
		const flood = await register(
			request('/oauth/register', { method: 'POST', json: { redirect_uris: [REDIRECT] } })
		)
		expect(flood.status).toBe(429)
	})
})

describe('cursor', () => {
	const CURSOR = 'cursor://anysphere.cursor-mcp/oauth/callback'

	it('registers with its three callbacks and gets a code back at the app callback', async () => {
		const clientId = await registerClient([
			CURSOR,
			'https://www.cursor.com/agents/mcp/oauth/callback',
			'http://localhost:8787/callback',
		])
		const url = await decide(authorizeQuery(clientId, { redirect_uri: CURSOR }))
		expect(`${url.protocol}//${url.host}${url.pathname}`).toBe(CURSOR)
		const code = url.searchParams.get('code') ?? ''
		const tokens = await exchange({
			grant_type: 'authorization_code',
			code,
			code_verifier: VERIFIER,
			client_id: clientId,
			redirect_uri: CURSOR,
			resource: RESOURCE,
		})
		expect(tokens.status).toBe(200)
	})
})

describe('authorization and tokens', () => {
	it('issues a code bound to the request and exchanges it once, with no-store tokens', async () => {
		const clientId = await registerClient()
		const url = await decide(authorizeQuery(clientId))
		expect(`${url.origin}${url.pathname}`).toBe(REDIRECT)
		expect(url.searchParams.get('state')).toBe('state-123')
		expect(url.searchParams.get('iss')).toBe(ORIGIN)
		const code = url.searchParams.get('code') ?? ''
		const form = {
			grant_type: 'authorization_code',
			code,
			code_verifier: VERIFIER,
			client_id: clientId,
			redirect_uri: REDIRECT,
			resource: RESOURCE,
		}
		const first = await exchange(form)
		expect(first.status).toBe(200)
		expect(first.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'diffcast' })
		expect(first.headers.get('cache-control')).toBe('no-store')
		expect(String(first.body['access_token'])).toMatch(/^[A-Za-z0-9_-]{43}$/)
		expect(state.tokens.every((row) => row.hash !== first.body['access_token'])).toBe(true)
	})

	it('revokes the grant when a code is used twice', async () => {
		const clientId = await registerClient()
		const code = await authorizeCode(clientId)
		const form = {
			grant_type: 'authorization_code',
			code,
			code_verifier: VERIFIER,
			client_id: clientId,
			redirect_uri: REDIRECT,
		}
		const first = await exchange(form)
		const second = await exchange(form)
		expect(second).toMatchObject({ status: 400, body: { error: 'invalid_grant' } })
		expect(state.grants[0]?.revoked).toBe(true)
		const client = mcpClient(String(first.body['access_token']))
		await expect(client).rejects.toThrow()
	})

	it('refuses a wrong or missing verifier, client, redirect, resource, and expired codes', async () => {
		const clientId = await registerClient()
		const other = await registerClient()
		const cases: [Record<string, string>, string][] = [
			[{ code_verifier: 'z'.repeat(50) }, 'invalid_grant'],
			[{ client_id: other }, 'invalid_grant'],
			[{ redirect_uri: 'http://127.0.0.1:43210/other' }, 'invalid_grant'],
			[{ resource: 'https://evil.example/api/mcp' }, 'invalid_target'],
		]
		for (const [overrides, error] of cases) {
			const code = await authorizeCode(clientId)
			const result = await exchange({
				grant_type: 'authorization_code',
				code,
				code_verifier: VERIFIER,
				client_id: clientId,
				redirect_uri: REDIRECT,
				...overrides,
			})
			expect(result.body['error'], JSON.stringify(overrides)).toBe(error)
		}
		const missing = await exchange({
			grant_type: 'authorization_code',
			code: await authorizeCode(clientId),
			client_id: clientId,
			redirect_uri: REDIRECT,
		})
		expect(missing.body['error']).toBe('invalid_request')
		const code = await authorizeCode(clientId)
		state.now = 11 * 60 * 1000
		const expired = await exchange({
			grant_type: 'authorization_code',
			code,
			code_verifier: VERIFIER,
			client_id: clientId,
			redirect_uri: REDIRECT,
		})
		expect(expired.body).toMatchObject({
			error: 'invalid_grant',
			error_description: 'This authorization code has expired.',
		})
		expect(state.grants).toEqual([])
		expect((await exchange({ grant_type: 'password' })).body['error']).toBe(
			'unsupported_grant_type'
		)
	})

	it('redirects a denial and validation errors back to the client with state and iss', async () => {
		const clientId = await registerClient()
		const denied = await decide(authorizeQuery(clientId), 'deny')
		expect(denied.searchParams.get('error')).toBe('access_denied')
		expect(denied.searchParams.get('state')).toBe('state-123')
		const plain = await decide(authorizeQuery(clientId, { code_challenge_method: 'plain' }))
		expect(plain.searchParams.get('error')).toBe('invalid_request')
		const wrongResource = await decide(
			authorizeQuery(clientId, { resource: 'https://other.example/mcp' })
		)
		expect(wrongResource.searchParams.get('error')).toBe('invalid_target')
		expect(state.codes).toEqual([])
	})

	it('sends an unsigned or unserved listener back to the authorize page instead of issuing a code', async () => {
		const clientId = await registerClient()
		state.cookie = undefined
		const unsigned = await decide(authorizeQuery(clientId))
		expect(unsigned.pathname).toBe('/oauth/authorize')
		state.cookie = signListenerSession({ listenerId: 2, epoch: 0 }, listenerSigningKey())
		const unserved = await decide(authorizeQuery(clientId))
		expect(unserved.pathname).toBe('/oauth/authorize')
		expect(state.codes).toEqual([])
	})

	it('refuses a code whose listener stopped being served before the exchange', async () => {
		const clientId = await registerClient()
		const code = await authorizeCode(clientId)
		const one = state.listeners.get(1)
		if (one) one.comped = false
		const result = await exchange({
			grant_type: 'authorization_code',
			code,
			code_verifier: VERIFIER,
			client_id: clientId,
			redirect_uri: REDIRECT,
		})
		expect(result.body).toMatchObject({ error: 'invalid_grant' })
	})

	it('rotates refresh tokens and revokes the whole grant when an old one comes back', async () => {
		const clientId = await registerClient()
		const first = await connect(clientId)
		const rotated = await exchange({
			grant_type: 'refresh_token',
			refresh_token: first.refresh_token,
			client_id: clientId,
			resource: RESOURCE,
		})
		expect(rotated.status).toBe(200)
		expect(rotated.body['refresh_token']).not.toBe(first.refresh_token)
		const tools = await (await mcpClient(String(rotated.body['access_token']))).listTools()
		expect(tools.tools.length).toBe(11)
		const replay = await exchange({
			grant_type: 'refresh_token',
			refresh_token: first.refresh_token,
			client_id: clientId,
		})
		expect(replay.body).toMatchObject({ error: 'invalid_grant' })
		expect(state.grants[0]?.revoked).toBe(true)
		const afterReplay = await exchange({
			grant_type: 'refresh_token',
			refresh_token: String(rotated.body['refresh_token']),
			client_id: clientId,
		})
		expect(afterReplay.body['error']).toBe('invalid_grant')
		await expect(mcpClient(String(rotated.body['access_token']))).rejects.toThrow()
	})

	it('refuses a refresh from another client or for another resource', async () => {
		const clientId = await registerClient()
		const other = await registerClient()
		const first = await connect(clientId)
		expect(
			(
				await exchange({
					grant_type: 'refresh_token',
					refresh_token: first.refresh_token,
					client_id: other,
				})
			).body['error']
		).toBe('invalid_grant')
		expect(
			(
				await exchange({
					grant_type: 'refresh_token',
					refresh_token: first.refresh_token,
					client_id: clientId,
					resource: 'https://evil.example/mcp',
				})
			).body['error']
		).toBe('invalid_target')
	})

	it('revokes on request, refresh revoking the whole grant', async () => {
		const clientId = await registerClient()
		const first = await connect(clientId)
		const response = await revoke(
			request('/oauth/revoke', {
				method: 'POST',
				form: { token: first.refresh_token, client_id: clientId, token_type_hint: 'refresh_token' },
			})
		)
		expect(response.status).toBe(200)
		expect(state.grants[0]?.revoked).toBe(true)
		await expect(mcpClient(first.access_token)).rejects.toThrow()
		const unknown = await revoke(
			request('/oauth/revoke', {
				method: 'POST',
				form: { token: 'q'.repeat(43), client_id: clientId },
			})
		)
		expect(unknown.status).toBe(200)
	})

	it('accepts a client id metadata document as the client', async () => {
		const clientId = 'https://agent.example.com/oauth/client.json'
		const url = await decide(authorizeQuery(clientId))
		expect(url.searchParams.get('code')).toBeTruthy()
		expect(state.fetchedDocuments).toEqual([clientId])
		await decide(authorizeQuery(clientId))
		expect(state.fetchedDocuments).toHaveLength(1)
	})
})

describe('mcp tools', () => {
	it('lists the tools and scopes every call to the token listener', async () => {
		const clientId = await registerClient()
		const { access_token } = await connect(clientId)
		const client = await mcpClient(access_token)
		const names = (await client.listTools()).tools.map((tool) => tool.name).sort()
		expect(names).toEqual([
			'add_interest',
			'clear_context',
			'get_interests',
			'get_latest_episode',
			'get_schedule',
			'list_context',
			'list_episodes',
			'push_context',
			'remove_interest',
			'set_days',
			'set_interests',
		])
		const pushed = await client.callTool({
			name: 'push_context',
			arguments: {
				project: 'Acme/Billing',
				packages: ['npm:stripe', 'fastapi'],
				topics: ['Webhooks'],
				summary: 'Queueing webhooks',
			},
		})
		expect(pushed.isError).toBeFalsy()
		expect(pushed.structuredContent).toMatchObject({
			context: { project: 'acme/billing', expiresAt: expect.any(String) },
		})
		expect(state.contexts.get(1)?.[0]?.project).toBe('acme/billing')
		expect(state.contexts.get(2)).toBeUndefined()

		await client.callTool({
			name: 'add_interest',
			arguments: { topic: 'Rust', take: 'Rust is worth it' },
		})
		expect(state.interests.get(1)?.map((row) => row.topic)).toEqual([
			'Security and privacy',
			'Rust',
		])
		const removed = await client.callTool({
			name: 'remove_interest',
			arguments: { topic: 'security and privacy' },
		})
		expect(removed.isError).toBeFalsy()
		const last = await client.callTool({ name: 'remove_interest', arguments: { topic: 'Rust' } })
		expect(last.isError).toBe(true)

		await client.callTool({ name: 'set_days', arguments: { days: ['sat', 'mon'] } })
		expect(state.listeners.get(1)?.days).toEqual([1, 6])

		const latest = await client.callTool({ name: 'get_latest_episode', arguments: {} })
		const episode = (latest.structuredContent as { episode: Record<string, unknown> }).episode
		expect(episode).toMatchObject({
			date: '2026-11-16',
			format: 'daily',
			durationSeconds: 600,
			link: `${ORIGIN}/account`,
		})
		expect(JSON.stringify(latest)).not.toContain('blob.vercel-storage.com')
		expect(JSON.stringify(latest)).not.toContain('turns')

		const cleared = await client.callTool({ name: 'clear_context', arguments: {} })
		expect(cleared.structuredContent).toEqual({ cleared: 1 })
	})

	it('rejects bad tool input without touching data', async () => {
		const { access_token } = await connect(await registerClient())
		const client = await mcpClient(access_token)
		for (const args of [
			{ project: 'has space' },
			{ project: 'ok', packages: ['rm -rf /'] },
			{ project: 'ok', packages: ['{"a":1}'] },
			{ project: 'ok', summary: 'x'.repeat(301) },
			{ project: 'ok', topics: ['line\nbreak'] },
		]) {
			const result = await client.callTool({ name: 'push_context', arguments: args })
			expect(result.isError, JSON.stringify(args)).toBe(true)
		}
		expect((await client.callTool({ name: 'set_days', arguments: { days: [] } })).isError).toBe(
			true
		)
		expect(
			(await client.callTool({ name: 'list_episodes', arguments: { limit: 15 } })).isError
		).toBe(true)
		expect(state.contexts.get(1)).toBeUndefined()
		expect(state.pushes.get(1)).toBeUndefined()
	})

	it('caps push_context at 60 a day', async () => {
		const { access_token } = await connect(await registerClient())
		const client = await mcpClient(access_token)
		state.pushes.set(1, 59)
		expect(
			(await client.callTool({ name: 'push_context', arguments: { project: 'a' } })).isError
		).toBeFalsy()
		const capped = await client.callTool({ name: 'push_context', arguments: { project: 'b' } })
		expect(capped.isError).toBe(true)
		expect(JSON.stringify(capped.content)).toContain('60 calls a day')
		expect(state.contexts.get(1)?.map((entry) => entry.project)).toEqual(['a'])
	})

	it('pauses every tool when the listener is no longer served', async () => {
		const { access_token } = await connect(await registerClient())
		const client = await mcpClient(access_token)
		const one = state.listeners.get(1)
		if (one) one.comped = false
		const result = await client.callTool({ name: 'get_interests', arguments: {} })
		expect(result.isError).toBe(true)
		expect(JSON.stringify(result.content)).toContain('not active')
	})

	it('rate limits a busy token', async () => {
		const { access_token } = await connect(await registerClient())
		for (let index = 0; index < 120; index += 1) mcpCalls.add(`grant:${state.grants[0]?.id}`)
		const response = await mcp(
			request('/api/mcp', {
				method: 'POST',
				headers: {
					authorization: `Bearer ${access_token}`,
					accept: 'application/json, text/event-stream',
				},
				json: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
			})
		)
		expect(response.status).toBe(429)
	})
})
