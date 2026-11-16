import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { dueListenerSchema, episodeScriptSchema } from '../../../shared/contract.ts'
import type { DueListener, EpisodeMetrics, EpisodeScript } from '../../../shared/contract.ts'
import { renderClips, ttsCharacters } from './clips.ts'
import type { ClipRenderer } from './clips.ts'
import { roundUsd } from './gateway-cost.ts'
import type { JobClient } from './job-api.ts'
import { log } from './log.ts'
import { mixEpisode, probeMix } from './mix.ts'
import type { MixedEpisode } from './mix.ts'
import type { ResearchRecord, Researcher } from './research.ts'
import { savedResearchNotesSchema } from './research-notes.ts'
import { inStep, STEPS } from './steps.ts'
import type { Step } from './steps.ts'
import { episodeDirectory, ensureDirectory, readJsonFile, writeJsonFile } from './work-directory.ts'
import type { EpisodeWriter, WriteRecord } from './writer.ts'

export type EpisodeUploader = (
	listenerId: number,
	date: string,
	mixed: MixedEpisode
) => Promise<string>

export type MetricsMode = { kind: 'measured' } | { kind: 'zeroed'; model: string }

export type PipelineServices = {
	jobs: JobClient
	researcher: Researcher
	writer: EpisodeWriter
	renderer: ClipRenderer
	upload: EpisodeUploader
	metrics: MetricsMode
}

export type PipelineOptions = {
	workDirectory: string
	fromStep: Step
	stopAfterMix: boolean
}

export type TtsRecord = { costUsd: number }

const researchRecordSchema = z.object({
	model: z.string(),
	inputTokens: z.number(),
	outputTokens: z.number(),
	costUsd: z.number(),
	webSearches: z.number(),
	webFetches: z.number(),
	researchSeconds: z.number(),
})

const writeRecordSchema = z.object({
	model: z.string(),
	inputTokens: z.number(),
	outputTokens: z.number(),
	costUsd: z.number(),
	attempts: z.number(),
})

const ttsRecordSchema = z.object({ costUsd: z.number() })

function startsBy(fromStep: Step, step: Step): boolean {
	return STEPS.indexOf(fromStep) <= STEPS.indexOf(step)
}

async function readSaved<T>(directory: string, file: string, schema: z.ZodType<T>): Promise<T> {
	const parsed = schema.safeParse(await readJsonFile(join(directory, file)))
	if (!parsed.success)
		throw new Error(`${file} in ${directory} is malformed: ${parsed.error.message}`)
	return parsed.data
}

export async function readSavedBrief(
	workDirectory: string,
	listenerId: number,
	date: string
): Promise<DueListener> {
	const directory = episodeDirectory(workDirectory, listenerId, date)
	return dueListenerSchema.parse(await readJsonFile(join(directory, 'brief.json')))
}

export function buildMetrics(
	research: ResearchRecord,
	write: WriteRecord,
	tts: TtsRecord,
	episode: EpisodeScript
): EpisodeMetrics {
	return {
		model: `${research.model} + ${write.model}`,
		inputTokens: research.inputTokens + write.inputTokens,
		outputTokens: research.outputTokens + write.outputTokens,
		webSearches: research.webSearches,
		webFetches: research.webFetches,
		ttsCharacters: ttsCharacters(episode.turns),
		llmCostUsd: roundUsd(research.costUsd + write.costUsd),
		ttsCostUsd: roundUsd(tts.costUsd),
		researchSeconds: Math.round(research.researchSeconds * 10) / 10,
	}
}

export function zeroedMetrics(model: string): EpisodeMetrics {
	return {
		model,
		inputTokens: 0,
		outputTokens: 0,
		webSearches: 0,
		webFetches: 0,
		ttsCharacters: 0,
		llmCostUsd: 0,
		ttsCostUsd: 0,
		researchSeconds: 0,
	}
}

export async function produceEpisode(
	listener: DueListener,
	services: PipelineServices,
	options: PipelineOptions
): Promise<void> {
	const { listenerId, date } = listener
	const directory = episodeDirectory(options.workDirectory, listenerId, date)
	await ensureDirectory(directory)

	const research = await inStep('research', async () => {
		if (!startsBy(options.fromStep, 'research')) {
			return {
				notes: await readSaved(directory, 'research-notes.json', savedResearchNotesSchema),
				record: await readSaved(directory, 'research.json', researchRecordSchema),
			}
		}
		await writeJsonFile(join(directory, 'brief.json'), listener)
		const result = await services.researcher.research(listener)
		await writeJsonFile(join(directory, 'research-notes.json'), result.notes)
		await writeJsonFile(join(directory, 'research.json'), result.record)
		return result
	})

	const written = await inStep('research', async () => {
		if (!startsBy(options.fromStep, 'write')) {
			return {
				episode: await readSaved(directory, 'episode.json', episodeScriptSchema),
				record: await readSaved(directory, 'write.json', writeRecordSchema),
			}
		}
		const result = await services.writer.write(listener, research.notes, (attempt, reply) =>
			writeFile(join(directory, `reply-${attempt}.json`), reply)
		)
		await writeJsonFile(join(directory, 'episode.json'), result.episode)
		await writeJsonFile(join(directory, 'write.json'), result.record)
		log(`listener ${listenerId}: "${result.episode.title}", ${result.episode.storyCount} stories`)
		return result
	})
	const episode = written.episode

	const { mixed, tts } = await (async () => {
		const ttsFile = join(directory, 'tts.json')
		if (!startsBy(options.fromStep, 'mix')) {
			return {
				mixed: await inStep('mix', () => probeMix(join(directory, 'episode.mp3'))),
				tts: await inStep('tts', () => readSaved(directory, 'tts.json', ttsRecordSchema)),
			}
		}
		const clips = await inStep('tts', async () => {
			const rendered = await renderClips(episode.turns, join(directory, 'clips'), services.renderer)
			await writeJsonFile(ttsFile, { costUsd: rendered.costUsd })
			return rendered
		})
		return {
			mixed: await inStep('mix', () => mixEpisode(directory, episode.turns, clips.files, date)),
			tts: { costUsd: clips.costUsd },
		}
	})()

	if (options.stopAfterMix) {
		log(`listener ${listenerId}: stopping after mix (${mixed.file})`)
		return
	}

	const audioUrl = await inStep('upload', async () => {
		const uploadFile = join(directory, 'upload.json')
		if (!startsBy(options.fromStep, 'upload')) {
			return (await readSaved(directory, 'upload.json', z.object({ url: z.string() }))).url
		}
		const url = await services.upload(listenerId, date, mixed)
		await writeJsonFile(uploadFile, { url })
		return url
	})

	await inStep('save', async () => {
		const response = await services.jobs.saveEpisode({
			...episode,
			listenerId,
			date,
			metrics:
				services.metrics.kind === 'zeroed'
					? zeroedMetrics(services.metrics.model)
					: buildMetrics(research.record, written.record, tts, episode),
			audioUrl,
			audioBytes: mixed.bytes,
			durationSeconds: mixed.durationSeconds,
		})
		log(`listener ${listenerId}: episode saved ${JSON.stringify(response)}`)
	})
}
