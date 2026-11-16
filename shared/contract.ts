import { z } from 'zod'

export const SPEAKERS = ['host', 'cohost'] as const
export const SPEAKER_NAMES: Record<(typeof SPEAKERS)[number], string> = {
	host: 'Mara',
	cohost: 'Theo',
}

export const SEGMENT_KINDS = ['news', 'stack', 'update', 'challenge', 'wildcard', 'watch'] as const

export const WORDS_PER_MINUTE = 150
export const MAX_AUDIO_BYTES = 60 * 1024 * 1024

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date as YYYY-MM-DD.')

export const dependencySchema = z.object({
	name: z.string().trim().min(1).max(214),
	ecosystem: z.enum(['npm', 'pypi', 'cargo', 'go', 'rubygems', 'other']),
})

export const sourceSchema = z.object({
	title: z.string().trim().min(1).max(300),
	url: z.string().trim().max(2000).refine(isHttpUrl, 'Source urls must be http(s).'),
})

export const segmentSchema = z.object({
	heading: z.string().trim().min(1).max(200),
	kind: z.enum(SEGMENT_KINDS),
	challenges: z.string().trim().max(500).nullable(),
	topics: z.array(z.string().trim().min(1).max(100)).max(10),
	packages: z.array(z.string().trim().min(1).max(214)).max(20),
	sources: z.array(sourceSchema).min(1).max(20),
})

export const turnSchema = z.object({
	speaker: z.enum(SPEAKERS),
	text: z.string().trim().min(1).max(4000),
})

export const episodeScriptSchema = z.object({
	title: z.string().trim().min(1).max(120),
	summary: z.string().trim().min(1).max(2000),
	storyCount: z.number().int().min(0).max(12),
	segments: z.array(segmentSchema).min(1).max(12),
	turns: z.array(turnSchema).min(1).max(400),
})

export const episodeMetricsSchema = z.object({
	model: z.string().min(1).max(100),
	inputTokens: z.number().int().min(0),
	outputTokens: z.number().int().min(0),
	webSearches: z.number().int().min(0),
	webFetches: z.number().int().min(0),
	ttsCharacters: z.number().int().min(0),
	llmCostUsd: z.number().min(0),
	ttsCostUsd: z.number().min(0),
	researchSeconds: z.number().min(0),
})

export const recentEpisodeSchema = z.object({
	date: day,
	title: z.string(),
	segments: z.array(
		z.object({ heading: z.string(), packages: z.array(z.string()), urls: z.array(z.string()) })
	),
})

export const interestSchema = z.object({
	topic: z.string().trim().min(1).max(100),
	take: z.string().trim().max(500).nullable(),
	note: z.string().trim().max(500).nullable(),
})

export const dueListenerSchema = z.object({
	listenerId: z.number().int().positive(),
	date: day,
	timezone: z.string().min(1),
	minutes: z.number().int().min(3).max(20),
	stack: z.array(dependencySchema).max(500),
	focus: z.string().max(2000),
	interests: z.array(interestSchema).max(40),
	recent: z.array(recentEpisodeSchema).max(15),
	feedback: z.array(z.object({ date: day, note: z.string() })).max(10),
})

export const dueResponseSchema = z.object({ listeners: z.array(dueListenerSchema) })

export const uploadRequestSchema = z.object({ listenerId: z.number().int().positive(), date: day })

export const uploadResponseSchema = z.object({ pathname: z.string(), clientToken: z.string() })

export const episodeRequestSchema = episodeScriptSchema.extend({
	listenerId: z.number().int().positive(),
	date: day,
	metrics: episodeMetricsSchema,
	audioUrl: z.string().url(),
	audioBytes: z.number().int().positive().max(MAX_AUDIO_BYTES),
	durationSeconds: z
		.number()
		.positive()
		.max(60 * 60),
})

export const failureRequestSchema = z.object({
	listenerId: z.number().int().positive(),
	date: day,
	step: z.enum(['research', 'validate', 'tts', 'mix', 'upload', 'save']),
	message: z.string().max(2000),
})

export type Dependency = z.infer<typeof dependencySchema>
export type Interest = z.infer<typeof interestSchema>
export type Segment = z.infer<typeof segmentSchema>
export type Turn = z.infer<typeof turnSchema>
export type EpisodeScript = z.infer<typeof episodeScriptSchema>
export type EpisodeMetrics = z.infer<typeof episodeMetricsSchema>
export type DueListener = z.infer<typeof dueListenerSchema>
export type EpisodeRequest = z.infer<typeof episodeRequestSchema>
export type FailureRequest = z.infer<typeof failureRequestSchema>
