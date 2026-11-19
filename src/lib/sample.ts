import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { SEGMENT_KINDS, sourceSchema } from '@shared/contract'

export const SAMPLE_AUDIO_PATH = '/sample/diffcast-sample.mp3'

const sampleSchema = z.object({
	title: z.string().min(1),
	summary: z.string().min(1),
	publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	durationSeconds: z.number().positive(),
	audioBytes: z.number().int().positive(),
	segments: z
		.array(
			z.object({
				kind: z.enum(SEGMENT_KINDS),
				heading: z.string().min(1),
				sources: z.array(sourceSchema).min(1),
			})
		)
		.min(1),
})

export type Sample = z.infer<typeof sampleSchema>

export function parseSample(text: string): Sample {
	return sampleSchema.parse(JSON.parse(text))
}

export function loadSample(): Sample | null {
	const directory = join(process.cwd(), 'public', 'sample')
	let text: string
	try {
		text = readFileSync(join(directory, 'sample.json'), 'utf8')
		statSync(join(directory, 'diffcast-sample.mp3'))
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
		throw error
	}
	return parseSample(text)
}
