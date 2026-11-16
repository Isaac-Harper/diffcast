import type { WorkContext } from '@shared/contract'
import { sql } from '../db'

export const CONTEXT_DAYS = 30
export const MAX_DUE_CONTEXT = 10
export const MAX_PUSHES_PER_DAY = 60

export interface StoredContext extends WorkContext {
	expiresAt: string
}

export interface ContextInput {
	project: string
	packages: string[]
	topics: string[]
	summary: string
}

export async function upsertWorkContext(
	listenerId: number,
	input: ContextInput
): Promise<StoredContext> {
	const rows = (await sql`
		INSERT INTO work_context (listener_id, project, packages, topics, summary, updated_at, expires_at)
		VALUES (${listenerId}, ${input.project}, ${input.packages}::text[], ${input.topics}::text[],
			${input.summary}, now(), now() + make_interval(days => ${CONTEXT_DAYS}))
		ON CONFLICT (listener_id, project) DO UPDATE SET packages = EXCLUDED.packages,
			topics = EXCLUDED.topics, summary = EXCLUDED.summary, updated_at = now(),
			expires_at = EXCLUDED.expires_at
		RETURNING project, packages, topics, summary, updated_at::text AS "updatedAt",
			expires_at::text AS "expiresAt"
	`) as StoredContext[]
	const row = rows[0]
	if (!row) throw new Error('Work context upsert returned no row')
	return row
}

export async function listWorkContext(listenerId: number): Promise<StoredContext[]> {
	return (await sql`
		SELECT project, packages, topics, summary, updated_at::text AS "updatedAt",
			expires_at::text AS "expiresAt"
		FROM work_context WHERE listener_id = ${listenerId} AND expires_at > now()
		ORDER BY updated_at DESC, id DESC
	`) as StoredContext[]
}

export async function clearWorkContext(
	listenerId: number,
	project: string | null
): Promise<number> {
	const rows = (await sql`
		DELETE FROM work_context
		WHERE listener_id = ${listenerId} AND (${project}::text IS NULL OR project = ${project})
		RETURNING id
	`) as { id: number }[]
	return rows.length
}

export async function activeWorkContext(
	listenerIds: number[]
): Promise<Map<number, WorkContext[]>> {
	const byListener = new Map<number, WorkContext[]>(listenerIds.map((id) => [id, []]))
	if (listenerIds.length === 0) return byListener
	const rows = (await sql`
		SELECT listener_id, project, packages, topics, summary, "updatedAt" FROM (
			SELECT listener_id, project, packages, topics, summary,
				to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "updatedAt",
				row_number() OVER (PARTITION BY listener_id ORDER BY updated_at DESC, id DESC) AS rank
			FROM work_context
			WHERE listener_id = ANY(${listenerIds}::int[]) AND expires_at > now()
		) ranked
		WHERE rank <= ${MAX_DUE_CONTEXT}
		ORDER BY listener_id, rank
	`) as ({ listener_id: number } & WorkContext)[]
	for (const { listener_id, ...context } of rows) {
		const list = byListener.get(listener_id)
		if (!list) throw new Error(`Work context for unrequested listener ${listener_id}`)
		list.push(context)
	}
	return byListener
}

export async function countPush(listenerId: number): Promise<number | null> {
	const rows = (await sql`
		INSERT INTO mcp_usage (listener_id, day, push_count) VALUES (${listenerId}, current_date, 1)
		ON CONFLICT (listener_id, day) DO UPDATE SET push_count = mcp_usage.push_count + 1
		WHERE mcp_usage.push_count < ${MAX_PUSHES_PER_DAY}
		RETURNING push_count
	`) as { push_count: number }[]
	return rows[0]?.push_count ?? null
}
