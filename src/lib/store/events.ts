import { sql } from '../db'
import type { EventKind } from '../events'

export async function recordEvent(kind: EventKind): Promise<void> {
	await sql`INSERT INTO events (kind) VALUES (${kind})`
}
