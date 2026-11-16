import { sql } from '../db'
import type { OAuthClient } from '../oauth/authorize-request'
import { servedListener } from './served'

export interface StoredClient extends OAuthClient {
	cacheUntil: string | null
}

export interface CodeRow {
	id: number
	clientId: string
	listenerId: number
	redirectUri: string
	codeChallenge: string
	resource: string
	scope: string
	expired: boolean
	served: boolean
}

export interface RefreshRow {
	id: number
	grantId: number
	clientId: string
	resource: string
	scope: string
	revoked: boolean
	expired: boolean
	grantRevoked: boolean
	served: boolean
}

export interface AccessRow {
	grantId: number
	listenerId: number
	clientId: string
	resource: string
	scope: string
	expiresAt: number
}

export interface TokenPair {
	accessHash: string
	accessExpiresAt: Date
	refreshHash: string
	refreshExpiresAt: Date
}

export interface GrantRow {
	id: number
	clientName: string
	createdAt: string
	lastUsedAt: string | null
}

export async function addRegisteredClient(
	id: string,
	name: string,
	redirectUris: string[]
): Promise<void> {
	await sql`
		INSERT INTO oauth_clients (id, kind, name, redirect_uris)
		VALUES (${id}, 'registered', ${name}, ${redirectUris}::text[])
	`
}

export async function getClient(id: string): Promise<StoredClient | null> {
	const rows = (await sql`
		SELECT id, kind, name, redirect_uris AS "redirectUris", cache_until::text AS "cacheUntil",
			(cache_until IS NOT NULL AND cache_until <= now()) AS stale
		FROM oauth_clients WHERE id = ${id}
	`) as (StoredClient & { stale: boolean })[]
	const row = rows[0]
	if (!row) return null
	const { stale, ...client } = row
	return stale ? { ...client, cacheUntil: null } : client
}

export async function saveMetadataClient(
	id: string,
	name: string,
	redirectUris: string[],
	cacheSeconds: number
): Promise<void> {
	await sql`
		INSERT INTO oauth_clients (id, kind, name, redirect_uris, cache_until)
		VALUES (${id}, 'metadata_document', ${name}, ${redirectUris}::text[],
			now() + make_interval(secs => ${cacheSeconds}))
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, redirect_uris = EXCLUDED.redirect_uris,
			cache_until = EXCLUDED.cache_until
		WHERE oauth_clients.kind = 'metadata_document'
	`
}

export async function addCode(input: {
	codeHash: string
	clientId: string
	listenerId: number
	redirectUri: string
	codeChallenge: string
	resource: string
	scope: string
	expiresAt: Date
}): Promise<void> {
	await sql`
		INSERT INTO oauth_codes (code_hash, client_id, listener_id, redirect_uri, code_challenge, resource,
			scope, expires_at)
		VALUES (${input.codeHash}, ${input.clientId}, ${input.listenerId}, ${input.redirectUri},
			${input.codeChallenge}, ${input.resource}, ${input.scope}, ${input.expiresAt.toISOString()}::timestamptz)
	`
}

export interface RedeemInput {
	codeHash: string
	clientId: string
	redirectUri: string
	codeChallenge: string | null
	resource: string
	tokens: TokenPair
}

export type RedeemOutcome =
	| { status: 'unknown' }
	| { status: 'reused'; grantId: number | null }
	| { status: 'refused'; code: CodeRow }
	| { status: 'redeemed'; code: CodeRow; grantId: number }

export async function redeemCode(input: RedeemInput): Promise<RedeemOutcome> {
	const rows = (await sql`
		WITH target AS (
			SELECT c.id, c.client_id AS "clientId", c.listener_id AS "listenerId",
				c.redirect_uri AS "redirectUri", c.code_challenge AS "codeChallenge", c.resource, c.scope,
				(c.expires_at <= now()) AS expired, ${servedListener()} AS served
			FROM oauth_codes c JOIN listeners l ON l.id = c.listener_id
			WHERE c.code_hash = ${input.codeHash} AND c.used_at IS NULL
			FOR UPDATE OF c
		), valid AS (
			SELECT * FROM target
			WHERE NOT expired AND served AND "clientId" = ${input.clientId}
				AND "redirectUri" = ${input.redirectUri} AND "codeChallenge" = ${input.codeChallenge}
				AND resource = ${input.resource}
		), grant_row AS (
			INSERT INTO oauth_grants (listener_id, client_id, resource, scope, last_used_at)
			SELECT "listenerId", "clientId", resource, scope, now() FROM valid
			RETURNING id
		), access AS (
			INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at)
			SELECT ${input.tokens.accessHash}, 'access', id,
				${input.tokens.accessExpiresAt.toISOString()}::timestamptz FROM grant_row
		), refresh AS (
			INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at)
			SELECT ${input.tokens.refreshHash}, 'refresh', id,
				${input.tokens.refreshExpiresAt.toISOString()}::timestamptz FROM grant_row
		), consumed AS (
			UPDATE oauth_codes SET used_at = now(), grant_id = (SELECT id FROM grant_row)
			WHERE id = (SELECT id FROM target)
			RETURNING id
		)
		SELECT target.*, (SELECT id FROM grant_row) AS "grantId" FROM target
	`) as (CodeRow & { grantId: number | null })[]
	const row = rows[0]
	if (row) {
		const { grantId, ...code } = row
		return grantId === null ? { status: 'refused', code } : { status: 'redeemed', code, grantId }
	}
	const used = (await sql`
		SELECT grant_id AS "grantId" FROM oauth_codes WHERE code_hash = ${input.codeHash}
	`) as { grantId: number | null }[]
	const usedRow = used[0]
	return usedRow ? { status: 'reused', grantId: usedRow.grantId } : { status: 'unknown' }
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshRow | null> {
	const rows = (await sql`
		SELECT t.id, t.grant_id AS "grantId", g.client_id AS "clientId", g.resource, g.scope,
			(t.revoked_at IS NOT NULL) AS revoked, (t.expires_at <= now()) AS expired,
			(g.revoked_at IS NOT NULL) AS "grantRevoked", ${servedListener()} AS served
		FROM oauth_tokens t
		JOIN oauth_grants g ON g.id = t.grant_id
		JOIN listeners l ON l.id = g.listener_id
		WHERE t.token_hash = ${tokenHash} AND t.kind = 'refresh'
	`) as RefreshRow[]
	return rows[0] ?? null
}

export async function rotateRefreshToken(
	tokenId: number,
	grantId: number,
	tokens: TokenPair
): Promise<boolean> {
	const rows = (await sql`
		WITH old AS (
			UPDATE oauth_tokens SET revoked_at = now()
			WHERE id = ${tokenId} AND revoked_at IS NULL
			RETURNING grant_id
		), access AS (
			INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at)
			SELECT ${tokens.accessHash}, 'access', grant_id,
				${tokens.accessExpiresAt.toISOString()}::timestamptz FROM old
		), refresh AS (
			INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at)
			SELECT ${tokens.refreshHash}, 'refresh', grant_id,
				${tokens.refreshExpiresAt.toISOString()}::timestamptz FROM old
		), touched AS (
			UPDATE oauth_grants SET last_used_at = now() FROM old WHERE oauth_grants.id = old.grant_id
				AND oauth_grants.id = ${grantId}
		)
		SELECT grant_id FROM old
	`) as { grant_id: number }[]
	return rows.length > 0
}

export async function revokeGrant(grantId: number): Promise<void> {
	await sql`
		WITH grant_row AS (
			UPDATE oauth_grants SET revoked_at = coalesce(revoked_at, now()) WHERE id = ${grantId}
			RETURNING id
		)
		UPDATE oauth_tokens SET revoked_at = now()
		WHERE grant_id IN (SELECT id FROM grant_row) AND revoked_at IS NULL
	`
}

export async function revokeToken(
	tokenHash: string,
	clientId: string
): Promise<{ kind: 'access' | 'refresh'; grantId: number } | null> {
	const rows = (await sql`
		UPDATE oauth_tokens t SET revoked_at = coalesce(t.revoked_at, now())
		FROM oauth_grants g
		WHERE t.token_hash = ${tokenHash} AND g.id = t.grant_id AND g.client_id = ${clientId}
		RETURNING t.kind, t.grant_id AS "grantId"
	`) as { kind: 'access' | 'refresh'; grantId: number }[]
	return rows[0] ?? null
}

export async function findAccessToken(tokenHash: string): Promise<AccessRow | null> {
	const rows = (await sql`
		SELECT g.id AS "grantId", g.listener_id AS "listenerId", g.client_id AS "clientId", g.resource,
			g.scope, extract(epoch FROM t.expires_at)::float8 AS "expiresAt"
		FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
		WHERE t.token_hash = ${tokenHash} AND t.kind = 'access' AND t.revoked_at IS NULL
			AND t.expires_at > now() AND g.revoked_at IS NULL
	`) as AccessRow[]
	return rows[0] ?? null
}

export async function touchGrant(grantId: number): Promise<void> {
	await sql`
		UPDATE oauth_grants SET last_used_at = now()
		WHERE id = ${grantId} AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')
	`
}

export async function listGrants(listenerId: number): Promise<GrantRow[]> {
	return (await sql`
		SELECT g.id, c.name AS "clientName", g.created_at::text AS "createdAt",
			g.last_used_at::text AS "lastUsedAt"
		FROM oauth_grants g JOIN oauth_clients c ON c.id = g.client_id
		WHERE g.listener_id = ${listenerId} AND g.revoked_at IS NULL
		ORDER BY g.created_at DESC
	`) as GrantRow[]
}

export async function revokeListenerGrant(listenerId: number, grantId: number): Promise<boolean> {
	const rows = (await sql`
		SELECT id FROM oauth_grants WHERE id = ${grantId} AND listener_id = ${listenerId}
	`) as { id: number }[]
	if (rows.length === 0) return false
	await revokeGrant(grantId)
	return true
}
