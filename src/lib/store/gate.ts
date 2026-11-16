import { sql } from '../db'
import type { Listened, Verdict, WouldPay } from '../episode-types'
import type { GateCheck, GateListener } from '../gate'

export async function gateListeners(dates: string[]): Promise<GateListener[]> {
	const listeners = (await sql`
		SELECT l.id, l.name, l.timezone,
			(SELECT would_pay FROM surveys s WHERE s.listener_id = l.id
				ORDER BY s.created_at DESC, s.id DESC LIMIT 1) AS would_pay
		FROM listeners l WHERE l.active ORDER BY l.name
	`) as { id: number; name: string; timezone: string; would_pay: WouldPay | null }[]
	const episodes = (await sql`
		SELECT e.listener_id, e.published_on::text, e.story_count,
			coalesce(e.metrics->>'model', '') AS model,
			(extract(epoch FROM e.created_at) * 1000)::float8 AS created_ms,
			(coalesce((e.metrics->>'llmCostUsd')::float8, 0) + coalesce((e.metrics->>'ttsCostUsd')::float8, 0))
				AS cost_usd,
			EXISTS (SELECT 1 FROM downloads d WHERE d.episode_id = e.id) AS downloaded,
			(SELECT f.listened FROM feedback f WHERE f.episode_id = e.id
				ORDER BY f.created_at DESC, f.id DESC LIMIT 1) AS listened
		FROM episodes e WHERE e.published_on = ANY(${dates}::date[])
	`) as {
		listener_id: number
		published_on: string
		model: string
		story_count: number
		created_ms: number
		cost_usd: number
		downloaded: boolean
		listened: Listened | null
	}[]
	return listeners.map((listener) => ({
		id: listener.id,
		name: listener.name,
		timezone: listener.timezone,
		wouldPay: listener.would_pay,
		episodes: episodes
			.filter((episode) => episode.listener_id === listener.id)
			.map((episode) => ({
				model: episode.model,
				publishedOn: episode.published_on,
				storyCount: episode.story_count,
				createdAtMs: episode.created_ms,
				costUsd: episode.cost_usd,
				downloaded: episode.downloaded,
				listened: episode.listened,
			})),
	}))
}

export async function gateChecks(dates: string[]): Promise<GateCheck[]> {
	return (await sql`
		SELECT c.verdict, coalesce(e.metrics->>'model', '') AS model
		FROM segment_checks c JOIN episodes e ON e.id = c.episode_id
		WHERE e.published_on = ANY(${dates}::date[])
	`) as { verdict: Verdict; model: string }[]
}
