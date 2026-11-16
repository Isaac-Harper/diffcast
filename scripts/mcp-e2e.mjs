import { createHash, randomBytes } from 'node:crypto'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const base = (process.argv[2] ?? process.env.DIFFCAST_E2E_BASE ?? 'http://localhost:3000').replace(
	/\/+$/,
	''
)
const cookie = process.env.DIFFCAST_E2E_COOKIE
const discoveryOnly = process.argv.includes('--discovery-only')
const REDIRECT = 'http://127.0.0.1:53682/callback'

function step(name) {
	console.warn(`\n== ${name}`)
}

function check(condition, message) {
	if (!condition) throw new Error(`FAILED: ${message}`)
	console.warn(`ok   ${message}`)
}

async function json(response) {
	const text = await response.text()
	try {
		return JSON.parse(text)
	} catch {
		throw new Error(
			`Expected JSON from ${response.url} (${response.status}): ${text.slice(0, 200)}`
		)
	}
}

function decodeEntities(value) {
	return value
		.replaceAll('&quot;', '"')
		.replaceAll('&#x27;', "'")
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&amp;', '&')
}

function consentFields(html) {
	const form = html.match(
		/<form[^>]*>(?:(?!<\/form>)[\s\S])*name="decision"(?:(?!<\/form>)[\s\S])*<\/form>/
	)
	if (!form) throw new Error('No consent form with a decision button in the authorize page')
	const fields = new FormData()
	for (const input of form[0].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
		const name = /name="([^"]*)"/.exec(input[0])?.[1]
		const value = /value="([^"]*)"/.exec(input[0])?.[1] ?? ''
		if (name) fields.append(decodeEntities(name), decodeEntities(value))
	}
	fields.append('decision', 'allow')
	return fields
}

async function callTool(client, name, args = {}) {
	const result = await client.callTool({ name, arguments: args })
	check(!result.isError, `${name}: ${result.content?.[0]?.text ?? ''}`.slice(0, 160))
	return result
}

async function connectSdk(resource, accessToken) {
	const client = new Client({ name: 'diffcast-e2e', version: '1.0.0' })
	await client.connect(
		new StreamableHTTPClientTransport(new URL(resource), {
			requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
		})
	)
	return client
}

step('Discovery from the 401')
const unauthenticated = await fetch(`${base}/api/mcp`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
	body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
})
check(unauthenticated.status === 401, `POST /api/mcp without a token answers 401`)
const challenge = unauthenticated.headers.get('www-authenticate') ?? ''
const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1]
check(Boolean(metadataUrl), `WWW-Authenticate carries resource_metadata (${metadataUrl})`)
const resourceMetadata = await json(await fetch(metadataUrl))
check(resourceMetadata.resource === `${base}/api/mcp`, `resource is ${resourceMetadata.resource}`)
const issuer = resourceMetadata.authorization_servers?.[0]
const suffixed = await json(await fetch(`${base}/.well-known/oauth-protected-resource/api/mcp`))
check(suffixed.resource === resourceMetadata.resource, 'path suffixed metadata matches')
const server = await json(await fetch(`${issuer}/.well-known/oauth-authorization-server`))
check(server.issuer === issuer, `authorization server issuer is ${issuer}`)
check(server.code_challenge_methods_supported?.includes('S256'), 'S256 PKCE is advertised')
if (discoveryOnly) {
	console.warn('\nDiscovery passed (--discovery-only, stopping before any database step).')
	process.exit(0)
}
if (!cookie) throw new Error('Set DIFFCAST_E2E_COOKIE to a diffcast_listener session cookie value')

step('Dynamic client registration')
const registration = await fetch(server.registration_endpoint, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({
		client_name: 'Diffcast e2e',
		redirect_uris: [REDIRECT],
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'none',
	}),
})
check(registration.status === 201, 'registration answers 201')
const { client_id: clientId } = await json(registration)

step('Authorize with PKCE and the listener session')
const verifier = randomBytes(32).toString('base64url')
const challengeValue = createHash('sha256').update(verifier).digest('base64url')
const state = randomBytes(8).toString('hex')
const authorizeUrl = new URL(server.authorization_endpoint)
for (const [key, value] of Object.entries({
	client_id: clientId,
	redirect_uri: REDIRECT,
	response_type: 'code',
	code_challenge: challengeValue,
	code_challenge_method: 'S256',
	state,
	resource: resourceMetadata.resource,
	scope: 'diffcast',
})) {
	authorizeUrl.searchParams.set(key, value)
}
const sessionCookie = `diffcast_listener=${cookie}`
const consent = await fetch(authorizeUrl, {
	headers: { cookie: sessionCookie },
	redirect: 'manual',
})
check(consent.status === 200, `consent page answers 200 (got ${consent.status})`)
const decision = await fetch(authorizeUrl, {
	method: 'POST',
	headers: { cookie: sessionCookie, origin: new URL(base).origin },
	body: consentFields(await consent.text()),
	redirect: 'manual',
})
const location = decision.headers.get('location') ?? decision.headers.get('x-action-redirect') ?? ''
const callback = new URL(location.split(';')[0], base)
check(
	`${callback.origin}${callback.pathname}` === REDIRECT,
	`Allow redirects to the callback (${decision.status})`
)
check(callback.searchParams.get('state') === state, 'state comes back unchanged')
check(callback.searchParams.get('iss') === issuer, 'iss is the issuer')
const code = callback.searchParams.get('code')
check(Boolean(code), 'an authorization code is issued')

step('Token exchange')
async function tokenRequest(fields) {
	const response = await fetch(server.token_endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields),
	})
	return { status: response.status, body: await json(response) }
}
const exchanged = await tokenRequest({
	grant_type: 'authorization_code',
	code,
	code_verifier: verifier,
	client_id: clientId,
	redirect_uri: REDIRECT,
	resource: resourceMetadata.resource,
})
check(exchanged.status === 200 && exchanged.body.access_token, 'code exchanges for tokens')
const reused = await tokenRequest({
	grant_type: 'authorization_code',
	code,
	code_verifier: verifier,
	client_id: clientId,
	redirect_uri: REDIRECT,
})
check(reused.body.error === 'invalid_grant', 'a reused code is refused')
check(
	(await mcpStatus(exchanged.body.access_token)) === 401,
	'the reuse revoked the grant the code produced'
)

async function authorizeAgain() {
	const page = await fetch(authorizeUrl, { headers: { cookie: sessionCookie } })
	const allowed = await fetch(authorizeUrl, {
		method: 'POST',
		headers: { cookie: sessionCookie, origin: new URL(base).origin },
		body: consentFields(await page.text()),
		redirect: 'manual',
	})
	const target = allowed.headers.get('location') ?? allowed.headers.get('x-action-redirect') ?? ''
	return new URL(target.split(';')[0], base).searchParams.get('code')
}

async function mcpStatus(accessToken) {
	const response = await fetch(`${base}/api/mcp`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${accessToken}`,
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
	})
	await response.arrayBuffer()
	return response.status
}

step('Concurrent double exchange of one code')
const racedCode = await authorizeAgain()
const raced = await Promise.all(
	Array.from({ length: 4 }, () =>
		tokenRequest({
			grant_type: 'authorization_code',
			code: racedCode,
			code_verifier: verifier,
			client_id: clientId,
			redirect_uri: REDIRECT,
			resource: resourceMetadata.resource,
		})
	)
)
const winners = raced.filter((result) => result.status === 200)
check(winners.length === 1, `exactly one of 4 concurrent exchanges wins (${winners.length})`)
check(
	raced.filter((result) => result.body.error === 'invalid_grant').length === 3,
	'the other 3 are refused as reused'
)
check(
	(await mcpStatus(winners[0].body.access_token)) === 401,
	'the replays revoked the winning grant, so no live grant survives the race'
)

step('Refresh on a fresh authorization')
const secondCode = await authorizeAgain()
const tokens = await tokenRequest({
	grant_type: 'authorization_code',
	code: secondCode,
	code_verifier: verifier,
	client_id: clientId,
	redirect_uri: REDIRECT,
	resource: resourceMetadata.resource,
})
check(tokens.status === 200, 'second authorization exchanges')
const refreshed = await tokenRequest({
	grant_type: 'refresh_token',
	refresh_token: tokens.body.refresh_token,
	client_id: clientId,
	resource: resourceMetadata.resource,
})
check(
	refreshed.status === 200 && refreshed.body.refresh_token !== tokens.body.refresh_token,
	'refresh rotates'
)

step('MCP through the official SDK client')
const client = await connectSdk(resourceMetadata.resource, refreshed.body.access_token)
const tools = await client.listTools()
check(tools.tools.length === 11, `tools/list returns ${tools.tools.length} tools`)
await callTool(client, 'get_interests')
await callTool(client, 'push_context', {
	project: 'e2e/probe',
	packages: ['npm:zod'],
	topics: ['Schema validation'],
	summary: 'End to end probe',
})
const listed = await callTool(client, 'list_context')
check(
	listed.structuredContent.contexts.some((entry) => entry.project === 'e2e/probe'),
	'list_context shows the pushed project'
)
await callTool(client, 'clear_context', { project: 'e2e/probe' })
await callTool(client, 'get_latest_episode')
await client.close()

step('Revoke')
const revoked = await fetch(server.revocation_endpoint, {
	method: 'POST',
	headers: { 'content-type': 'application/x-www-form-urlencoded' },
	body: new URLSearchParams({
		token: refreshed.body.refresh_token,
		client_id: clientId,
		token_type_hint: 'refresh_token',
	}),
})
check(revoked.status === 200, 'revocation answers 200')
check(
	(await mcpStatus(refreshed.body.access_token)) === 401,
	'the access token stops working after revocation'
)

console.warn('\nAll steps passed.')
