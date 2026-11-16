import type { EpisodeMetrics, Segment, Turn } from '@shared/contract'

export const LISTENED = ['yes', 'partly', 'no'] as const
export const USEFUL = ['up', 'down'] as const
export const WOULD_PAY = ['yes', 'maybe', 'no'] as const
export const VERDICTS = ['correct', 'error', 'unclear'] as const

export type Listened = (typeof LISTENED)[number]
export type Useful = (typeof USEFUL)[number]
export type WouldPay = (typeof WOULD_PAY)[number]
export type Verdict = (typeof VERDICTS)[number]

export interface FeedEpisode {
	id: number
	published_on: string
	title: string
	summary: string
	segments: Segment[]
	audio_url: string
	audio_bytes: number
	duration_seconds: number
}

export interface EpisodeDetail extends FeedEpisode {
	listener_id: number
	story_count: number
	turns: Turn[]
	metrics: EpisodeMetrics
	created_at: string
}
