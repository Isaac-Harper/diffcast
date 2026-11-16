import { sql } from '../db'

export interface WaitlistEntry {
	id: number
	email: string
	podcast_app: string | null
	stack_text: string
	created_at: string
	invited_at: string | null
}

export async function addWaitlistEntry(input: {
	email: string
	podcastApp: string | null
	stackText: string
}): Promise<void> {
	await sql`
		INSERT INTO waitlist (email, podcast_app, stack_text)
		VALUES (${input.email}, ${input.podcastApp}, ${input.stackText})
		ON CONFLICT (lower(email)) DO NOTHING
	`
}

export async function listWaitlist(): Promise<WaitlistEntry[]> {
	return (await sql`
		SELECT id, email, podcast_app, stack_text, created_at::text, invited_at::text
		FROM waitlist ORDER BY created_at DESC, id DESC
	`) as WaitlistEntry[]
}

export async function getWaitlistEntry(id: number): Promise<WaitlistEntry | null> {
	const rows = (await sql`
		SELECT id, email, podcast_app, stack_text, created_at::text, invited_at::text
		FROM waitlist WHERE id = ${id}
	`) as WaitlistEntry[]
	return rows[0] ?? null
}

export async function markWaitlistInvited(id: number): Promise<void> {
	await sql`UPDATE waitlist SET invited_at = now() WHERE id = ${id} AND invited_at IS NULL`
}
