import { sql } from '../db'

export interface ActiveFeedToken {
	id: number
	listenerId: number
}

export interface FeedTokenRow {
	id: number
	label: string
	created_at: string
	revoked_at: string | null
	last_fetched_at: string | null
	last_user_agent: string | null
	fetch_count: number
}

export async function findActiveFeedToken(tokenHash: string): Promise<ActiveFeedToken | null> {
	const rows = (await sql`
		SELECT t.id, t.listener_id AS "listenerId"
		FROM feed_tokens t JOIN listeners l ON l.id = t.listener_id
		WHERE t.token_hash = ${tokenHash} AND t.revoked_at IS NULL AND l.active
	`) as ActiveFeedToken[]
	return rows[0] ?? null
}

export async function recordFeedFetch(id: number, userAgent: string | null): Promise<void> {
	await sql`
		UPDATE feed_tokens SET last_fetched_at = now(), last_user_agent = ${userAgent},
			fetch_count = fetch_count + 1
		WHERE id = ${id} AND (last_fetched_at IS NULL OR last_fetched_at < now() - interval '1 minute')
	`
}

export async function listFeedTokens(listenerId: number): Promise<FeedTokenRow[]> {
	return (await sql`
		SELECT id, label, created_at::text, revoked_at::text, last_fetched_at::text, last_user_agent,
			fetch_count
		FROM feed_tokens WHERE listener_id = ${listenerId} ORDER BY created_at DESC, id DESC
	`) as FeedTokenRow[]
}

export async function addFeedToken(
	listenerId: number,
	label: string,
	tokenHash: string
): Promise<void> {
	await sql`
		INSERT INTO feed_tokens (listener_id, label, token_hash)
		VALUES (${listenerId}, ${label}, ${tokenHash})
	`
}

export async function revokeFeedToken(id: number): Promise<void> {
	await sql`UPDATE feed_tokens SET revoked_at = now() WHERE id = ${id} AND revoked_at IS NULL`
}
