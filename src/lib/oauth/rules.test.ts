import { describe, expect, it } from 'vitest'
import {
	dayKeys,
	dayNumbers,
	isPlausiblePackage,
	pushContextInput,
	setDaysInput,
} from '../mcp/rules'
import { safeReturnPath } from '../return-path'
import { checkAuthorizeRequest } from './authorize-request'
import type { OAuthClient } from './authorize-request'
import {
	isClientIdUrl,
	metadataCacheSeconds,
	parseClientMetadata,
	parseMetadataDocument,
} from './client-metadata'
import { isPublicAddress } from './fetch-metadata-document'
import { authorizationServerMetadata, protectedResourceMetadata, sameResource } from './metadata'
import {
	isAllowedRedirectUri,
	isAppOrLoopbackRedirect,
	redirectHost,
	withQuery,
} from './redirect-uris'
import { s256Challenge, verifyPkce } from './secrets'

const ORIGIN = 'https://diffcast.fm'
const VERIFIER = 'v'.repeat(43)
const CHALLENGE = s256Challenge(VERIFIER)
const CLIENT: OAuthClient = {
	id: 'dc_client',
	name: 'Claude Code',
	kind: 'registered',
	redirectUris: ['http://localhost:51234/callback'],
}

function authorize(overrides: Record<string, string | null> = {}) {
	const values: Record<string, string | null> = {
		client_id: CLIENT.id,
		redirect_uri: CLIENT.redirectUris[0] ?? null,
		response_type: 'code',
		code_challenge: CHALLENGE,
		code_challenge_method: 'S256',
		state: 'xyz',
		resource: `${ORIGIN}/api/mcp`,
		scope: 'diffcast',
		...overrides,
	}
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(values)) if (value !== null) params.set(key, value)
	return params
}

describe('redirect uris', () => {
	it('allows https anywhere and http only on loopback, never fragments or userinfo', () => {
		expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true)
		expect(isAllowedRedirectUri('http://localhost:3334/callback')).toBe(true)
		expect(isAllowedRedirectUri('http://127.0.0.1:61000/cb')).toBe(true)
		expect(isAllowedRedirectUri('http://[::1]:8080/cb')).toBe(true)
		expect(isAllowedRedirectUri('http://example.com/cb')).toBe(false)
		expect(isAllowedRedirectUri('http://localhost.evil.com/cb')).toBe(false)
		expect(isAllowedRedirectUri('https://example.com/cb#frag')).toBe(false)
		expect(isAllowedRedirectUri('https://user:pass@example.com/cb')).toBe(false)
		expect(isAllowedRedirectUri('cursor://anysphere.cursor-mcp/oauth/callback')).toBe(false)
		expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false)
		expect(isAllowedRedirectUri('not a url')).toBe(false)
	})
})

describe('pkce', () => {
	it('verifies S256 only for the matching verifier', () => {
		expect(verifyPkce(VERIFIER, CHALLENGE)).toBe(true)
		expect(verifyPkce('w'.repeat(43), CHALLENGE)).toBe(false)
		expect(verifyPkce('short', s256Challenge('short'))).toBe(false)
		expect(verifyPkce(VERIFIER, VERIFIER)).toBe(false)
	})
})

describe('resources', () => {
	it('matches the canonical MCP url, tolerating case and a trailing slash, nothing else', () => {
		expect(sameResource('https://diffcast.fm/api/mcp', `${ORIGIN}/api/mcp`)).toBe(true)
		expect(sameResource('HTTPS://DIFFCAST.FM/api/mcp/', `${ORIGIN}/api/mcp`)).toBe(true)
		expect(sameResource('https://diffcast.fm', `${ORIGIN}/api/mcp`)).toBe(false)
		expect(sameResource('https://evil.example/api/mcp', `${ORIGIN}/api/mcp`)).toBe(false)
		expect(sameResource('https://diffcast.fm/api/mcp?x=1', `${ORIGIN}/api/mcp`)).toBe(false)
		expect(sameResource('nonsense', `${ORIGIN}/api/mcp`)).toBe(false)
	})

	it('publishes metadata the spec requires', () => {
		expect(protectedResourceMetadata(ORIGIN)).toMatchObject({
			resource: 'https://diffcast.fm/api/mcp',
			authorization_servers: ['https://diffcast.fm'],
			scopes_supported: ['diffcast'],
		})
		expect(authorizationServerMetadata(ORIGIN)).toMatchObject({
			issuer: ORIGIN,
			authorization_endpoint: `${ORIGIN}/oauth/authorize`,
			token_endpoint: `${ORIGIN}/oauth/token`,
			registration_endpoint: `${ORIGIN}/oauth/register`,
			revocation_endpoint: `${ORIGIN}/oauth/revoke`,
			code_challenge_methods_supported: ['S256'],
			grant_types_supported: ['authorization_code', 'refresh_token'],
			token_endpoint_auth_methods_supported: ['none'],
			scopes_supported: ['diffcast'],
			client_id_metadata_document_supported: true,
			authorization_response_iss_parameter_supported: true,
		})
	})
})

describe('client registration', () => {
	it('accepts a public client with loopback or https redirects', () => {
		expect(
			parseClientMetadata(
				{
					client_name: 'Cursor',
					redirect_uris: ['http://127.0.0.1:4000/cb', 'http://127.0.0.1:4000/cb'],
					token_endpoint_auth_method: 'none',
					grant_types: ['authorization_code', 'refresh_token'],
					response_types: ['code'],
				},
				{ requireName: false, allowAppCallbacks: true }
			)
		).toEqual({ ok: true, client: { name: 'Cursor', redirectUris: ['http://127.0.0.1:4000/cb'] } })
		expect(
			parseClientMetadata(
				{ redirect_uris: ['https://x.example/cb'] },
				{ requireName: false, allowAppCallbacks: true }
			)
		).toMatchObject({ ok: true, client: { name: 'An unnamed agent' } })
	})

	it('rejects confidential clients, bad redirects and odd grants', () => {
		const cases: unknown[] = [
			null,
			[],
			{},
			{ redirect_uris: [] },
			{ redirect_uris: ['http://example.com/cb'] },
			{ redirect_uris: Array.from({ length: 11 }, (_, index) => `https://x.example/${index}`) },
			{
				redirect_uris: ['https://x.example/cb'],
				token_endpoint_auth_method: 'client_secret_basic',
			},
			{ redirect_uris: ['https://x.example/cb'], grant_types: ['client_credentials'] },
			{ redirect_uris: ['https://x.example/cb'], grant_types: ['refresh_token'] },
			{ redirect_uris: ['https://x.example/cb'], response_types: ['token'] },
			{ redirect_uris: ['https://x.example/cb'], client_name: 'x'.repeat(201) },
			{ redirect_uris: ['https://x.example/cb'], client_name: 7 },
		]
		for (const body of cases) {
			expect(
				parseClientMetadata(body, { requireName: false, allowAppCallbacks: true }).ok,
				JSON.stringify(body)
			).toBe(false)
		}
	})
})

describe('client id metadata documents', () => {
	const url = 'https://client.example.com/oauth/client.json'

	it('needs an https url with a path, no fragment, no userinfo, no dot segments', () => {
		expect(isClientIdUrl(url)).toBe(true)
		expect(isClientIdUrl('https://client.example.com/')).toBe(false)
		expect(isClientIdUrl('http://client.example.com/c.json')).toBe(false)
		expect(isClientIdUrl('https://client.example.com/c.json#x')).toBe(false)
		expect(isClientIdUrl('https://u:p@client.example.com/c.json')).toBe(false)
		expect(isClientIdUrl('dc_1234')).toBe(false)
	})

	it('requires the document to name itself exactly, carry a name and valid redirects', () => {
		const document = {
			client_id: url,
			client_name: 'Example',
			redirect_uris: ['http://localhost:3000/cb'],
		}
		expect(parseMetadataDocument(url, document)).toMatchObject({ ok: true })
		expect(parseMetadataDocument(url, { ...document, client_id: `${url}?x` }).ok).toBe(false)
		expect(parseMetadataDocument(url, { ...document, client_name: undefined }).ok).toBe(false)
		expect(parseMetadataDocument(url, { ...document, client_secret: 's' }).ok).toBe(false)
		expect(
			parseMetadataDocument(url, { ...document, redirect_uris: ['http://evil.com/cb'] }).ok
		).toBe(false)
	})

	it('caches between 5 minutes and a day', () => {
		expect(metadataCacheSeconds(null)).toBe(3600)
		expect(metadataCacheSeconds('max-age=10')).toBe(300)
		expect(metadataCacheSeconds('public, max-age=7200')).toBe(7200)
		expect(metadataCacheSeconds('max-age=999999')).toBe(86400)
		expect(metadataCacheSeconds('no-store')).toBe(300)
	})

	it('refuses to fetch from private, loopback or special addresses', () => {
		for (const address of [
			'127.0.0.1',
			'10.1.2.3',
			'172.16.0.1',
			'192.168.1.1',
			'169.254.169.254',
			'100.64.0.1',
			'0.0.0.0',
			'::1',
			'fd00::1',
			'fe80::1',
			'::ffff:127.0.0.1',
			'::ffff:7f00:1',
			'::127.0.0.1',
			'::7f00:1',
			'::a00:1',
			'64:ff9b::a00:1',
			'64:ff9b:1::a00:1',
			'fec0::1',
			'2001:db8::1',
			'2002:7f00:1::1',
			'4000::1',
		]) {
			expect(isPublicAddress(address), address).toBe(false)
		}
		expect(isPublicAddress('93.184.216.34')).toBe(true)
		expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
		expect(isPublicAddress('2a00:1450:4001::200e')).toBe(true)
		expect(isPublicAddress('not-an-ip')).toBe(false)
	})

	it('accepts only port 443 client id urls', () => {
		expect(isClientIdUrl('https://client.example.com:443/c.json')).toBe(true)
		expect(isClientIdUrl('https://client.example.com:8443/c.json')).toBe(false)
	})
})

describe('cursor app callback', () => {
	const cursor = 'cursor://anysphere.cursor-mcp/oauth/callback'

	it('is allowed exactly, and only for registered clients', () => {
		const body = {
			client_name: 'Cursor',
			redirect_uris: [
				cursor,
				'https://www.cursor.com/agents/mcp/oauth/callback',
				'http://localhost:8787/callback',
			],
		}
		expect(
			parseClientMetadata(body, { requireName: false, allowAppCallbacks: true })
		).toMatchObject({ ok: true, client: { redirectUris: body.redirect_uris } })
		expect(parseClientMetadata(body, { requireName: false, allowAppCallbacks: false }).ok).toBe(
			false
		)
		for (const near of [
			'cursor://anysphere.cursor-mcp/oauth/callback/',
			'cursor://anysphere.cursor-mcp/oauth/other',
			'cursor://evil.example/oauth/callback',
			'vscode://anysphere.cursor-mcp/oauth/callback',
		]) {
			expect(
				parseClientMetadata(
					{ redirect_uris: [near] },
					{ requireName: false, allowAppCallbacks: true }
				).ok,
				near
			).toBe(false)
		}
		expect(
			parseMetadataDocument('https://c.example/c.json', {
				client_id: 'https://c.example/c.json',
				client_name: 'Not Cursor',
				redirect_uris: [cursor],
			}).ok
		).toBe(false)
	})

	it('redirects back to the app with the code', () => {
		const url = new URL(withQuery(cursor, { code: 'abc', state: 's', iss: 'https://diffcast.fm' }))
		expect(`${url.protocol}//${url.host}${url.pathname}`).toBe(cursor)
		expect(url.searchParams.get('code')).toBe('abc')
		expect(redirectHost(cursor)).toBe('the Cursor app on this computer')
		expect(isAppOrLoopbackRedirect(cursor)).toBe(true)
	})
})

describe('authorization requests', () => {
	it('accepts a complete request and binds the canonical resource and scope', () => {
		expect(checkAuthorizeRequest(authorize(), CLIENT, ORIGIN)).toEqual({
			kind: 'ok',
			request: {
				clientId: 'dc_client',
				clientName: 'Claude Code',
				clientKind: 'registered',
				redirectUri: 'http://localhost:51234/callback',
				state: 'xyz',
				codeChallenge: CHALLENGE,
				resource: 'https://diffcast.fm/api/mcp',
				scope: 'diffcast',
			},
		})
		expect(
			checkAuthorizeRequest(authorize({ resource: null, scope: null, state: null }), CLIENT, ORIGIN)
		).toMatchObject({ kind: 'ok', request: { state: null, resource: `${ORIGIN}/api/mcp` } })
	})

	it('never redirects for an unknown client or an unregistered redirect uri', () => {
		expect(checkAuthorizeRequest(authorize(), null, ORIGIN).kind).toBe('show_error')
		for (const redirect of ['http://localhost:51234/other', 'https://evil.example/cb', null]) {
			expect(
				checkAuthorizeRequest(authorize({ redirect_uri: redirect }), CLIENT, ORIGIN).kind
			).toBe('show_error')
		}
	})

	it('redirects errors for missing or wrong PKCE, response type, resource or scope, keeping state', () => {
		const cases: [Record<string, string | null>, string][] = [
			[{ code_challenge: null }, 'invalid_request'],
			[{ code_challenge: 'short' }, 'invalid_request'],
			[{ code_challenge_method: 'plain' }, 'invalid_request'],
			[{ code_challenge_method: null }, 'invalid_request'],
			[{ response_type: 'token' }, 'unsupported_response_type'],
			[{ resource: 'https://evil.example/api/mcp' }, 'invalid_target'],
			[{ resource: 'https://diffcast.fm' }, 'invalid_target'],
			[{ scope: 'admin' }, 'invalid_scope'],
		]
		for (const [overrides, error] of cases) {
			expect(
				checkAuthorizeRequest(authorize(overrides), CLIENT, ORIGIN),
				JSON.stringify(overrides)
			).toMatchObject({
				kind: 'redirect_error',
				error,
				state: 'xyz',
				redirectUri: 'http://localhost:51234/callback',
			})
		}
	})
})

describe('return paths', () => {
	it('allows only the account and the authorize page on this site', () => {
		expect(safeReturnPath('/account')).toBe('/account')
		expect(safeReturnPath('/oauth/authorize?client_id=a&state=b')).toBe(
			'/oauth/authorize?client_id=a&state=b'
		)
		for (const value of [
			'https://evil.example/oauth/authorize',
			'//evil.example/account',
			'/\\evil.example',
			'/admin',
			'/account?x=1',
			'/oauth/token',
			'account',
			null,
			42,
		]) {
			expect(safeReturnPath(value), String(value)).toBeNull()
		}
	})
})

describe('mcp input rules', () => {
	it('accepts plausible package names from each ecosystem and rejects injection', () => {
		for (const name of [
			'next',
			'@vercel/blob',
			'npm:zod',
			'fastapi',
			'Django',
			'pypi:scikit-learn',
			'serde_json',
			'cargo:tokio',
			'github.com/spf13/cobra',
			'go:golang.org/x/net',
			'rails',
		]) {
			expect(isPlausiblePackage(name), name).toBe(true)
		}
		for (const name of [
			'',
			'left pad',
			'"quoted"',
			"it's",
			'{x}',
			'a;b',
			'line\nbreak',
			'ignore previous instructions',
			'x'.repeat(215),
		]) {
			expect(isPlausiblePackage(name), name).toBe(false)
		}
	})

	it('validates push_context caps and lowercases the project', () => {
		expect(pushContextInput.safeParse({ project: 'Acme/API' })).toMatchObject({
			success: true,
			data: { project: 'acme/api' },
		})
		const bad = [
			{ project: '' },
			{ project: 'my project' },
			{ project: 'x'.repeat(81) },
			{ project: 'a', packages: Array.from({ length: 201 }, (_, index) => `p${index}`) },
			{ project: 'a', topics: Array.from({ length: 21 }, (_, index) => `t${index}`) },
			{ project: 'a', topics: ['two\nlines'] },
			{ project: 'a', topics: ['x'.repeat(101)] },
			{ project: 'a', summary: 'x'.repeat(301) },
			{ project: 'a', summary: '{"role":"system"}' },
		]
		for (const input of bad) {
			expect(pushContextInput.safeParse(input).success, JSON.stringify(input).slice(0, 60)).toBe(
				false
			)
		}
	})

	it('maps day names to ISO weekdays and back', () => {
		expect(dayNumbers(['sun', 'mon', 'mon', 'sat'])).toEqual([1, 6, 7])
		expect(dayKeys([1, 7])).toEqual(['mon', 'sun'])
		expect(setDaysInput.safeParse({ days: [] }).success).toBe(false)
		expect(setDaysInput.safeParse({ days: ['funday'] }).success).toBe(false)
	})
})
