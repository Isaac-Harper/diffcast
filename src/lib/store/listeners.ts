import type { Dependency } from '@shared/contract'
import { sql } from '../db'
import { DEFAULT_INTERESTS } from '../interests'
import { servedListener } from './served'

export interface Listener {
	id: number
	name: string
	email: string | null
	timezone: string
	stack: Dependency[]
	focus: string
	minutes: number
	days: number[]
	active: boolean
	comped: boolean
	subscription_status: string | null
	current_period_end: string | null
	stripe_customer_id: string | null
}

export interface ListenerSummary extends Listener {
	episode_count: number
	last_episode: string | null
	last_fetched_at: string | null
}

export interface ListenerInput {
	name: string
	email: string | null
	timezone: string
	stack: Dependency[]
	focus: string
	minutes: number
	days: number[]
}

export async function listServedListeners(): Promise<Listener[]> {
	return (await sql`
		SELECT l.id, l.name, l.email, l.timezone, l.stack, l.focus, l.minutes, l.days, l.active, l.comped,
			l.subscription_status, l.current_period_end::text, l.stripe_customer_id
		FROM listeners l WHERE ${servedListener()} ORDER BY l.id
	`) as Listener[]
}

export async function findServedListenerByEmail(email: string): Promise<Listener | null> {
	const rows = (await sql`
		SELECT l.id, l.name, l.email, l.timezone, l.stack, l.focus, l.minutes, l.days, l.active, l.comped,
			l.subscription_status, l.current_period_end::text, l.stripe_customer_id
		FROM listeners l WHERE lower(l.email) = lower(${email}) AND ${servedListener()}
		ORDER BY l.id LIMIT 1
	`) as Listener[]
	return rows[0] ?? null
}

export async function listListenerSummaries(): Promise<ListenerSummary[]> {
	return (await sql`
		SELECT l.id, l.name, l.email, l.timezone, l.stack, l.focus, l.minutes, l.days, l.active, l.comped,
			l.subscription_status, l.current_period_end::text, l.stripe_customer_id,
			(SELECT count(*)::int FROM episodes e WHERE e.listener_id = l.id) AS episode_count,
			(SELECT max(published_on)::text FROM episodes e WHERE e.listener_id = l.id) AS last_episode,
			(SELECT max(last_fetched_at)::text FROM feed_tokens t WHERE t.listener_id = l.id)
				AS last_fetched_at
		FROM listeners l ORDER BY l.active DESC, l.name
	`) as ListenerSummary[]
}

export async function getListener(id: number): Promise<Listener | null> {
	const rows = (await sql`
		SELECT id, name, email, timezone, stack, focus, minutes, days, active, comped, subscription_status,
			current_period_end::text, stripe_customer_id
		FROM listeners WHERE id = ${id}
	`) as Listener[]
	return rows[0] ?? null
}

export async function listenerExists(id: number): Promise<boolean> {
	const rows = (await sql`SELECT 1 FROM listeners WHERE id = ${id}`) as unknown[]
	return rows.length > 0
}

export async function addCompedListener(input: ListenerInput): Promise<number> {
	const rows = (await sql`
		WITH created AS (
			INSERT INTO listeners (name, email, timezone, stack, focus, minutes, days, comped)
			VALUES (${input.name}, ${input.email}, ${input.timezone}, ${JSON.stringify(input.stack)}::jsonb,
				${input.focus}, ${input.minutes}, ${input.days}::smallint[], true)
			RETURNING id
		), seeded AS (
			INSERT INTO interests (listener_id, topic, sort)
			SELECT created.id, defaults.topic, (defaults.sort - 1)::int
			FROM created, unnest(${[...DEFAULT_INTERESTS]}::text[]) WITH ORDINALITY AS defaults (topic, sort)
		)
		SELECT id FROM created
	`) as { id: number }[]
	const row = rows[0]
	if (!row) throw new Error('Listener insert returned no row')
	return row.id
}

export async function updateListener(id: number, input: ListenerInput): Promise<void> {
	await sql`
		UPDATE listeners SET name = ${input.name}, email = ${input.email}, timezone = ${input.timezone},
			stack = ${JSON.stringify(input.stack)}::jsonb, focus = ${input.focus}, minutes = ${input.minutes},
			days = ${input.days}::smallint[]
		WHERE id = ${id}
	`
}

export async function setListenerDays(id: number, days: number[]): Promise<void> {
	await sql`UPDATE listeners SET days = ${days}::smallint[] WHERE id = ${id}`
}

export async function setListenerActive(id: number, active: boolean): Promise<void> {
	await sql`UPDATE listeners SET active = ${active} WHERE id = ${id}`
}

export async function listenerNames(): Promise<{ id: number; name: string }[]> {
	return (await sql`SELECT id, name FROM listeners ORDER BY name`) as { id: number; name: string }[]
}

export async function sessionEpoch(id: number): Promise<number | null> {
	const rows = (await sql`SELECT session_epoch FROM listeners WHERE id = ${id}`) as {
		session_epoch: number
	}[]
	return rows[0]?.session_epoch ?? null
}

export async function bumpSessionEpoch(id: number): Promise<number> {
	const rows = (await sql`
		UPDATE listeners SET session_epoch = session_epoch + 1 WHERE id = ${id} RETURNING session_epoch
	`) as { session_epoch: number }[]
	const row = rows[0]
	if (!row) throw new Error(`Cannot end sessions for missing listener ${id}`)
	return row.session_epoch
}

export async function setListenerProfile(
	id: number,
	input: { timezone: string; focus: string; stack: Dependency[] }
): Promise<void> {
	await sql`
		UPDATE listeners SET timezone = ${input.timezone}, focus = ${input.focus},
			stack = ${JSON.stringify(input.stack)}::jsonb
		WHERE id = ${id}
	`
}
