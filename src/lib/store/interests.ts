import type { Interest } from '@shared/contract'
import { sql, transaction } from '../db'
import type { InterestRow } from '../interests'

export interface StoredInterest extends InterestRow {
	id: number
	sort: number
}

export async function listInterests(listenerId: number): Promise<StoredInterest[]> {
	return (await sql`
		SELECT id, topic, take, note, active, sort FROM interests
		WHERE listener_id = ${listenerId} ORDER BY sort, id
	`) as StoredInterest[]
}

export async function activeInterests(listenerIds: number[]): Promise<Map<number, Interest[]>> {
	const byListener = new Map<number, Interest[]>(listenerIds.map((id) => [id, []]))
	if (listenerIds.length === 0) return byListener
	const rows = (await sql`
		SELECT listener_id, topic, take, note FROM interests
		WHERE active AND listener_id = ANY(${listenerIds}::int[]) ORDER BY listener_id, sort, id
	`) as ({ listener_id: number } & Interest)[]
	for (const { listener_id, ...interest } of rows) {
		const list = byListener.get(listener_id)
		if (!list) throw new Error(`Interest for unrequested listener ${listener_id}`)
		list.push(interest)
	}
	return byListener
}

export async function saveInterests(listenerId: number, rows: InterestRow[]): Promise<void> {
	await transaction([
		sql`DELETE FROM interests WHERE listener_id = ${listenerId}`,
		sql`
			INSERT INTO interests (listener_id, topic, take, note, active, sort)
			SELECT ${listenerId}, topic, take, note, active, (sort - 1)::int
			FROM unnest(${rows.map((row) => row.topic)}::text[], ${rows.map((row) => row.take)}::text[],
				${rows.map((row) => row.note)}::text[], ${rows.map((row) => row.active)}::boolean[])
				WITH ORDINALITY AS row (topic, take, note, active, sort)
		`,
	])
}
