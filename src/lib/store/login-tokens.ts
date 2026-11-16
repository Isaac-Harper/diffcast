import { sql } from '../db'

export async function addLoginToken(
	listenerId: number,
	tokenHash: string,
	expiresAt: Date
): Promise<void> {
	await sql`
		INSERT INTO login_tokens (listener_id, token_hash, expires_at)
		VALUES (${listenerId}, ${tokenHash}, ${expiresAt.toISOString()}::timestamptz)
	`
}

export async function consumeLoginToken(tokenHash: string): Promise<number | null> {
	const rows = (await sql`
		UPDATE login_tokens SET used_at = now()
		WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
		RETURNING listener_id
	`) as { listener_id: number }[]
	return rows[0]?.listener_id ?? null
}
