import {
	consumeCode,
	createGrant,
	findRefreshToken,
	revokeGrant,
	revokeToken,
	rotateRefreshToken,
} from '../store/oauth'
import type { TokenPair } from '../store/oauth'
import { ACCESS_TOKEN_SECONDS, REFRESH_TOKEN_SECONDS, resourceFor, sameResource } from './metadata'
import { hashSecret, isOpaqueSecret, newOpaqueSecret, verifyPkce } from './secrets'

export type TokenError =
	| 'invalid_request'
	| 'invalid_grant'
	| 'invalid_client'
	| 'unsupported_grant_type'
	| 'invalid_target'

export type TokenOutcome =
	| { ok: true; body: TokenBody }
	| { ok: false; status: 400 | 401; error: TokenError; description: string }

export interface TokenBody {
	access_token: string
	token_type: 'Bearer'
	expires_in: number
	refresh_token: string
	scope: string
}

function failure(error: TokenError, description: string): TokenOutcome {
	return { ok: false, status: error === 'invalid_client' ? 401 : 400, error, description }
}

function single(form: URLSearchParams, key: string): string | null {
	const values = form.getAll(key)
	return values.length === 1 ? (values[0] ?? null) : null
}

function newTokens(now: number): { pair: TokenPair; access: string; refresh: string } {
	const access = newOpaqueSecret()
	const refresh = newOpaqueSecret()
	return {
		access,
		refresh,
		pair: {
			accessHash: hashSecret('access', access),
			accessExpiresAt: new Date(now + ACCESS_TOKEN_SECONDS * 1000),
			refreshHash: hashSecret('refresh', refresh),
			refreshExpiresAt: new Date(now + REFRESH_TOKEN_SECONDS * 1000),
		},
	}
}

function body(access: string, refresh: string, scope: string): TokenBody {
	return {
		access_token: access,
		token_type: 'Bearer',
		expires_in: ACCESS_TOKEN_SECONDS,
		refresh_token: refresh,
		scope,
	}
}

function resourceMismatch(form: URLSearchParams, expected: string): boolean {
	const values = form.getAll('resource')
	if (values.length === 0) return false
	return values.length > 1 || !sameResource(values[0] ?? '', expected)
}

async function exchangeCode(
	form: URLSearchParams,
	origin: string,
	now: number
): Promise<TokenOutcome> {
	const code = single(form, 'code')
	const verifier = single(form, 'code_verifier')
	const clientId = single(form, 'client_id')
	const redirectUri = single(form, 'redirect_uri')
	if (!code || !verifier || !clientId || !redirectUri) {
		return failure(
			'invalid_request',
			'code, code_verifier, client_id and redirect_uri are required.'
		)
	}
	if (!isOpaqueSecret(code)) return failure('invalid_grant', 'Unknown authorization code.')
	const consumed = await consumeCode(hashSecret('code', code))
	if (!consumed) return failure('invalid_grant', 'Unknown authorization code.')
	if (consumed.status === 'reused') {
		if (consumed.grantId !== null) await revokeGrant(consumed.grantId)
		return failure('invalid_grant', 'This authorization code was already used.')
	}
	const row = consumed.code
	if (row.expired) return failure('invalid_grant', 'This authorization code has expired.')
	if (row.clientId !== clientId)
		return failure('invalid_grant', 'The code was issued to another client.')
	if (row.redirectUri !== redirectUri) {
		return failure('invalid_grant', 'redirect_uri does not match the authorization request.')
	}
	if (!verifyPkce(verifier, row.codeChallenge)) {
		return failure('invalid_grant', 'code_verifier does not match the code challenge.')
	}
	if (row.resource !== resourceFor(origin) || resourceMismatch(form, row.resource)) {
		return failure('invalid_target', 'resource does not match the authorization request.')
	}
	if (!row.served) return failure('invalid_grant', 'This Diffcast subscription is not active.')
	const tokens = newTokens(now)
	await createGrant({
		codeId: row.id,
		listenerId: row.listenerId,
		clientId: row.clientId,
		resource: row.resource,
		scope: row.scope,
		tokens: tokens.pair,
	})
	return { ok: true, body: body(tokens.access, tokens.refresh, row.scope) }
}

async function refresh(form: URLSearchParams, origin: string, now: number): Promise<TokenOutcome> {
	const token = single(form, 'refresh_token')
	const clientId = single(form, 'client_id')
	if (!token || !clientId)
		return failure('invalid_request', 'refresh_token and client_id are required.')
	if (!isOpaqueSecret(token)) return failure('invalid_grant', 'Unknown refresh token.')
	const row = await findRefreshToken(hashSecret('refresh', token))
	if (!row) return failure('invalid_grant', 'Unknown refresh token.')
	if (row.clientId !== clientId)
		return failure('invalid_grant', 'The token was issued to another client.')
	if (row.revoked) {
		await revokeGrant(row.grantId)
		return failure(
			'invalid_grant',
			'This refresh token was already used; the connection is revoked.'
		)
	}
	if (row.grantRevoked) return failure('invalid_grant', 'This connection was revoked.')
	if (row.expired) return failure('invalid_grant', 'This refresh token has expired.')
	if (row.resource !== resourceFor(origin) || resourceMismatch(form, row.resource)) {
		return failure('invalid_target', 'resource does not match this connection.')
	}
	if (!row.served) return failure('invalid_grant', 'This Diffcast subscription is not active.')
	const tokens = newTokens(now)
	if (!(await rotateRefreshToken(row.id, row.grantId, tokens.pair))) {
		await revokeGrant(row.grantId)
		return failure(
			'invalid_grant',
			'This refresh token was already used; the connection is revoked.'
		)
	}
	return { ok: true, body: body(tokens.access, tokens.refresh, row.scope) }
}

export async function tokenRequest(
	form: URLSearchParams,
	origin: string,
	now: number = Date.now()
): Promise<TokenOutcome> {
	const grantType = single(form, 'grant_type')
	if (grantType === 'authorization_code') return exchangeCode(form, origin, now)
	if (grantType === 'refresh_token') return refresh(form, origin, now)
	if (grantType === null) return failure('invalid_request', 'grant_type is required.')
	return failure('unsupported_grant_type', 'Use authorization_code or refresh_token.')
}

export async function revocationRequest(form: URLSearchParams): Promise<void> {
	const token = single(form, 'token')
	const clientId = single(form, 'client_id')
	if (!token || !clientId || !isOpaqueSecret(token)) return
	const hint = single(form, 'token_type_hint')
	const kinds: ('access' | 'refresh')[] =
		hint === 'access_token' ? ['access', 'refresh'] : ['refresh', 'access']
	for (const kind of kinds) {
		const revoked = await revokeToken(hashSecret(kind, token), clientId)
		if (revoked) {
			if (revoked.kind === 'refresh') await revokeGrant(revoked.grantId)
			return
		}
	}
}
