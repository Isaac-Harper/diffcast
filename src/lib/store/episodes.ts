import type { EpisodeRequest } from '@shared/contract'
import { sql } from '../db'
import type { EpisodeDetail, FeedEpisode } from '../episode-types'

export interface RecentEpisode {
	date: string
	title: string
	segments: { heading: string; packages: string[]; urls: string[] }[]
}

export interface EpisodeListRow {
	id: number
	listener_id: number
	listener_name: string
	published_on: string
	title: string
	story_count: number
	duration_seconds: number
	cost_usd: number
	downloads: number
	checked: number
}

export async function existingEpisodeKeys(
	pairs: { listenerId: number; date: string }[]
): Promise<Set<string>> {
	if (pairs.length === 0) return new Set()
	const rows = (await sql`
		SELECT listener_id, published_on::text FROM episodes
		WHERE (listener_id, published_on) IN (
			SELECT * FROM unnest(${pairs.map((pair) => pair.listenerId)}::int[],
				${pairs.map((pair) => pair.date)}::date[])
		)
	`) as { listener_id: number; published_on: string }[]
	return new Set(rows.map((row) => `${row.listener_id}:${row.published_on}`))
}

export async function lastEpisodeDates(
	pairs: { listenerId: number; date: string }[]
): Promise<Map<number, string>> {
	if (pairs.length === 0) return new Map()
	const rows = (await sql`
		SELECT due.listener_id, max(e.published_on)::text AS last
		FROM unnest(${pairs.map((pair) => pair.listenerId)}::int[],
			${pairs.map((pair) => pair.date)}::date[]) AS due (listener_id, on_date)
		JOIN episodes e ON e.listener_id = due.listener_id AND e.published_on < due.on_date
		GROUP BY due.listener_id
	`) as { listener_id: number; last: string }[]
	return new Map(rows.map((row) => [row.listener_id, row.last]))
}

export async function latestEpisodeDate(listenerId: number): Promise<string | null> {
	const rows = (await sql`
		SELECT max(published_on)::text AS latest FROM episodes WHERE listener_id = ${listenerId}
	`) as { latest: string | null }[]
	return rows[0]?.latest ?? null
}

export async function recentEpisodes(listenerId: number, limit: number): Promise<RecentEpisode[]> {
	const rows = (await sql`
		SELECT published_on::text AS date, title, segments FROM episodes
		WHERE listener_id = ${listenerId} ORDER BY published_on DESC LIMIT ${limit}
	`) as { date: string; title: string; segments: FeedEpisode['segments'] }[]
	return rows.map((row) => ({
		date: row.date,
		title: row.title,
		segments: row.segments.map((segment) => ({
			heading: segment.heading,
			packages: segment.packages,
			urls: segment.sources.map((source) => source.url),
		})),
	}))
}

export async function recentFeedbackNotes(
	listenerId: number,
	limit: number
): Promise<{ date: string; note: string }[]> {
	return (await sql`
		SELECT date, note FROM (
			SELECT DISTINCT ON (f.episode_id) e.published_on::text AS date, f.note
			FROM feedback f JOIN episodes e ON e.id = f.episode_id
			WHERE e.listener_id = ${listenerId}
			ORDER BY f.episode_id, f.created_at DESC, f.id DESC
		) latest
		WHERE note <> '' ORDER BY date DESC LIMIT ${limit}
	`) as { date: string; note: string }[]
}

export async function listFeedEpisodes(listenerId: number, limit: number): Promise<FeedEpisode[]> {
	return (await sql`
		SELECT id, published_on::text, title, summary, segments, audio_url,
			audio_bytes::float8 AS audio_bytes, duration_seconds
		FROM episodes WHERE listener_id = ${listenerId} ORDER BY published_on DESC LIMIT ${limit}
	`) as FeedEpisode[]
}

export async function listenerEpisodeAudio(
	listenerId: number,
	episodeId: number
): Promise<string | null> {
	const rows = (await sql`
		SELECT audio_url FROM episodes WHERE id = ${episodeId} AND listener_id = ${listenerId}
	`) as { audio_url: string }[]
	return rows[0]?.audio_url ?? null
}

export async function listenerOwnsEpisode(listenerId: number, episodeId: number): Promise<boolean> {
	const rows = (await sql`
		SELECT 1 FROM episodes WHERE id = ${episodeId} AND listener_id = ${listenerId}
	`) as unknown[]
	return rows.length > 0
}

export async function upsertEpisode(
	body: EpisodeRequest
): Promise<{ id: number; replaced: boolean; oldAudioUrl: string | null }> {
	const rows = (await sql`
		WITH old AS (
			SELECT audio_url FROM episodes
			WHERE listener_id = ${body.listenerId} AND published_on = ${body.date}::date
		)
		INSERT INTO episodes (listener_id, published_on, title, summary, story_count, segments, turns,
			metrics, audio_url, audio_bytes, duration_seconds)
		VALUES (${body.listenerId}, ${body.date}::date, ${body.title}, ${body.summary}, ${body.storyCount},
			${JSON.stringify(body.segments)}::jsonb, ${JSON.stringify(body.turns)}::jsonb,
			${JSON.stringify(body.metrics)}::jsonb, ${body.audioUrl}, ${body.audioBytes},
			${body.durationSeconds})
		ON CONFLICT (listener_id, published_on) DO UPDATE SET title = EXCLUDED.title,
			summary = EXCLUDED.summary, story_count = EXCLUDED.story_count, segments = EXCLUDED.segments,
			turns = EXCLUDED.turns, metrics = EXCLUDED.metrics, audio_url = EXCLUDED.audio_url,
			audio_bytes = EXCLUDED.audio_bytes, duration_seconds = EXCLUDED.duration_seconds,
			updated_at = now()
		RETURNING id, (SELECT audio_url FROM old) AS old_audio_url
	`) as { id: number; old_audio_url: string | null }[]
	const row = rows[0]
	if (!row) throw new Error('Episode upsert returned no row')
	return { id: row.id, replaced: row.old_audio_url !== null, oldAudioUrl: row.old_audio_url }
}

export async function recordDownload(
	episodeId: number,
	feedTokenId: number,
	userAgent: string | null
): Promise<void> {
	await sql`
		INSERT INTO downloads (episode_id, feed_token_id, method, user_agent)
		SELECT ${episodeId}, ${feedTokenId}, 'GET', ${userAgent}
		WHERE NOT EXISTS (
			SELECT 1 FROM downloads WHERE episode_id = ${episodeId} AND feed_token_id = ${feedTokenId}
				AND at > now() - interval '1 hour'
		)
	`
}

export async function listEpisodes(listenerId: number | null): Promise<EpisodeListRow[]> {
	return (await sql`
		SELECT e.id, e.listener_id, l.name AS listener_name, e.published_on::text, e.title, e.story_count,
			e.duration_seconds,
			(coalesce((e.metrics->>'llmCostUsd')::float8, 0) + coalesce((e.metrics->>'ttsCostUsd')::float8, 0))
				AS cost_usd,
			(SELECT count(*)::int FROM downloads d WHERE d.episode_id = e.id) AS downloads,
			(SELECT count(*)::int FROM segment_checks c WHERE c.episode_id = e.id) AS checked
		FROM episodes e JOIN listeners l ON l.id = e.listener_id
		WHERE ${listenerId}::int IS NULL OR e.listener_id = ${listenerId}
		ORDER BY e.published_on DESC, l.name LIMIT 200
	`) as EpisodeListRow[]
}

export async function getEpisode(
	id: number
): Promise<(EpisodeDetail & { listener_name: string; timezone: string }) | null> {
	const rows = (await sql`
		SELECT e.id, e.listener_id, l.name AS listener_name, l.timezone, e.published_on::text, e.title,
			e.summary, e.story_count, e.segments, e.turns, e.metrics, e.audio_url,
			e.audio_bytes::float8 AS audio_bytes, e.duration_seconds, e.created_at::text
		FROM episodes e JOIN listeners l ON l.id = e.listener_id WHERE e.id = ${id}
	`) as (EpisodeDetail & { listener_name: string; timezone: string })[]
	return rows[0] ?? null
}
