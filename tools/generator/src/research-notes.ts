import { z } from 'zod'
import { SEGMENT_KINDS, sourceSchema } from '../../../shared/contract.ts'
import { log } from './log.ts'

export const storyNoteSchema = z.object({
	headline: z.string().trim().min(1).max(200),
	whatHappened: z.string().trim().min(1).max(2000).describe('The facts, as the sources state them'),
	whyItMatters: z
		.string()
		.trim()
		.min(1)
		.max(1000)
		.describe('Why it matters to this listener, judged from their interests, notes and focus'),
	dates: z.string().trim().max(200).describe('When it happened or was published, from the sources'),
	interests: z
		.array(z.string().trim().min(1).max(100))
		.max(10)
		.describe('Interest topics it serves'),
	packages: z
		.array(z.string().trim().min(1).max(214))
		.max(20)
		.describe('Stack packages it touches'),
	kind: z.enum(SEGMENT_KINDS),
	challenges: z
		.string()
		.trim()
		.max(500)
		.nullable()
		.describe('For a challenge story, the take it tests, quoted from the brief; otherwise null'),
	sources: z.array(sourceSchema).min(1).max(10).describe('Pages you fetched that support it'),
})

export const researchNotesSchema = z.object({
	stories: z.array(storyNoteSchema).max(12),
	quietDay: z.string().trim().max(1000).describe('If little happened, what you checked and found'),
})

export const savedResearchNotesSchema = researchNotesSchema.extend({
	fetched: z.array(sourceSchema),
})

export type Source = z.infer<typeof sourceSchema>
export type StoryNote = z.infer<typeof storyNoteSchema>
export type ResearchNotes = z.infer<typeof researchNotesSchema>
export type SavedResearchNotes = z.infer<typeof savedResearchNotesSchema>

export function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url)
		parsed.hash = ''
		return parsed.toString().replace(/\/$/, '')
	} catch {
		return url
	}
}

export function reconcileNotes(notes: ResearchNotes, fetched: Source[]): SavedResearchNotes {
	const fetchedUrls = new Set(fetched.map((source) => normalizeUrl(source.url)))
	const stories: StoryNote[] = []
	for (const story of notes.stories) {
		const sources = story.sources.filter((source) => fetchedUrls.has(normalizeUrl(source.url)))
		const dropped = story.sources.length - sources.length
		if (dropped) log(`research: "${story.headline}" cited ${dropped} source(s) it never fetched`)
		if (sources.length === 0) {
			log(`research: dropping "${story.headline}", no fetched source supports it`)
			continue
		}
		stories.push({ ...story, sources })
	}
	return { ...notes, stories, fetched }
}
