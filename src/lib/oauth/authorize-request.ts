import { isCodeChallenge } from './secrets'
import { resourceFor, sameResource, SCOPE } from './metadata'
import { matchesRegisteredRedirect } from './redirect-uris'

export interface OAuthClient {
	id: string
	name: string
	redirectUris: string[]
	kind: 'registered' | 'metadata_document'
}

export interface AuthorizeRequest {
	clientId: string
	clientName: string
	clientKind: OAuthClient['kind']
	redirectUri: string
	state: string | null
	codeChallenge: string
	resource: string
	scope: string
}

export type AuthorizeCheck =
	| { kind: 'ok'; request: AuthorizeRequest }
	| { kind: 'show_error'; message: string }
	| {
			kind: 'redirect_error'
			redirectUri: string
			error: 'invalid_request' | 'unsupported_response_type' | 'invalid_scope' | 'invalid_target'
			description: string
			state: string | null
	  }

const MAX_STATE = 1000

function single(params: URLSearchParams, key: string): string | null | 'repeated' {
	const values = params.getAll(key)
	if (values.length > 1) return 'repeated'
	return values[0] ?? null
}

export function checkAuthorizeRequest(
	params: URLSearchParams,
	client: OAuthClient | null,
	origin: string
): AuthorizeCheck {
	if (!client) return { kind: 'show_error', message: 'This agent is not registered with Diffcast.' }
	const redirectUri = single(params, 'redirect_uri')
	if (
		redirectUri === null ||
		redirectUri === 'repeated' ||
		!matchesRegisteredRedirect(client.redirectUris, redirectUri)
	) {
		return {
			kind: 'show_error',
			message:
				'The agent sent a redirect address it did not register, so Diffcast will not send you there.',
		}
	}
	const rawState = single(params, 'state')
	const state = rawState === 'repeated' ? null : rawState
	const fail = (
		error: 'invalid_request' | 'unsupported_response_type' | 'invalid_scope' | 'invalid_target',
		description: string
	): AuthorizeCheck => ({ kind: 'redirect_error', redirectUri, error, description, state })

	if (rawState === 'repeated') return fail('invalid_request', 'state was sent more than once.')
	if (state !== null && state.length > MAX_STATE)
		return fail('invalid_request', 'state is too long.')
	const responseType = single(params, 'response_type')
	if (responseType !== 'code') {
		return fail('unsupported_response_type', 'Only response_type=code is supported.')
	}
	const challenge = single(params, 'code_challenge')
	const method = single(params, 'code_challenge_method')
	if (challenge === null || challenge === 'repeated' || !isCodeChallenge(challenge)) {
		return fail('invalid_request', 'A PKCE code_challenge is required.')
	}
	if (method !== 'S256') return fail('invalid_request', 'code_challenge_method must be S256.')
	const expectedResource = resourceFor(origin)
	const resource = single(params, 'resource')
	if (resource === 'repeated' || (resource !== null && !sameResource(resource, expectedResource))) {
		return fail('invalid_target', `resource must be ${expectedResource}.`)
	}
	const scope = single(params, 'scope')
	if (scope === 'repeated') return fail('invalid_scope', 'scope was sent more than once.')
	if (scope !== null && scope.trim() !== '') {
		const scopes = scope.split(' ').filter(Boolean)
		if (scopes.some((entry) => entry !== SCOPE && entry !== 'offline_access')) {
			return fail('invalid_scope', `The only scope is ${SCOPE}.`)
		}
	}
	return {
		kind: 'ok',
		request: {
			clientId: client.id,
			clientName: client.name,
			clientKind: client.kind,
			redirectUri,
			state,
			codeChallenge: challenge,
			resource: expectedResource,
			scope: SCOPE,
		},
	}
}
