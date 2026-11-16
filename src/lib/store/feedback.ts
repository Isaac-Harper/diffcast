import { sql } from '../db'
import type { Listened, Useful, Verdict } from '../episode-types'

export interface FeedbackRow {
	episode_id: number
	listened: Listened
	useful: Useful | null
	note: string
	created_at: string
}

export interface SegmentCheckRow {
	segment_index: number
	verdict: Verdict
	note: string
	checked_at: string
}

export interface DownloadRow {
	at: string
	method: string
	user_agent: string | null
	label: string
}

export async function addFeedback(
	episodeId: number,
	input: { listened: Listened; useful: Useful | null; note: string }
): Promise<void> {
	await sql`
		INSERT INTO feedback (episode_id, listened, useful, note)
		VALUES (${episodeId}, ${input.listened}, ${input.useful}, ${input.note})
	`
}

export async function latestFeedbackForListener(listenerId: number): Promise<FeedbackRow[]> {
	return (await sql`
		SELECT DISTINCT ON (f.episode_id) f.episode_id, f.listened, f.useful, f.note, f.created_at::text
		FROM feedback f JOIN episodes e ON e.id = f.episode_id
		WHERE e.listener_id = ${listenerId}
		ORDER BY f.episode_id, f.created_at DESC, f.id DESC
	`) as FeedbackRow[]
}

export async function feedbackForEpisode(episodeId: number): Promise<FeedbackRow[]> {
	return (await sql`
		SELECT episode_id, listened, useful, note, created_at::text FROM feedback
		WHERE episode_id = ${episodeId} ORDER BY created_at DESC, id DESC
	`) as FeedbackRow[]
}

export async function segmentChecks(episodeId: number): Promise<SegmentCheckRow[]> {
	return (await sql`
		SELECT segment_index, verdict, note, checked_at::text FROM segment_checks
		WHERE episode_id = ${episodeId} ORDER BY segment_index
	`) as SegmentCheckRow[]
}

export async function saveSegmentCheck(
	episodeId: number,
	segmentIndex: number,
	input: { verdict: Verdict; note: string }
): Promise<void> {
	await sql`
		INSERT INTO segment_checks (episode_id, segment_index, verdict, note)
		VALUES (${episodeId}, ${segmentIndex}, ${input.verdict}, ${input.note})
		ON CONFLICT (episode_id, segment_index) DO UPDATE SET verdict = EXCLUDED.verdict,
			note = EXCLUDED.note, checked_at = now()
	`
}

export async function downloadsForEpisode(episodeId: number): Promise<DownloadRow[]> {
	return (await sql`
		SELECT d.at::text, d.method, d.user_agent, t.label FROM downloads d
		JOIN feed_tokens t ON t.id = d.feed_token_id
		WHERE d.episode_id = ${episodeId} ORDER BY d.at DESC LIMIT 100
	`) as DownloadRow[]
}
