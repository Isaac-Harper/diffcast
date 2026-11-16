import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dueListenerSchema, episodeScriptSchema } from '../../../shared/contract.ts'
import type { DueListener, EpisodeMetrics, EpisodeScript } from '../../../shared/contract.ts'
import { renderClips, ttsCharacters } from './clips.ts'
import type { ClipRenderer } from './clips.ts'
import type { JobClient } from './job-api.ts'
import { log } from './log.ts'
import { mixEpisode, probeMix } from './mix.ts'
import { llmCostUsd, ttsCostUsd } from './pricing.ts'
import type { ResearchUsage } from './pricing.ts'
import type { ScriptWriter } from './script-writer.ts'
import { inStep, STEPS } from './steps.ts'
import type { Step } from './steps.ts'
import { uploadEpisode } from './upload.ts'
import { episodeDirectory, ensureDirectory, readJsonFile, writeJsonFile } from './work-directory.ts'

export type PipelineServices = {
	jobs: JobClient
	writer: ScriptWriter
	renderer: ClipRenderer
	ttsUsdPerThousandCharacters: number
}

export type PipelineOptions = {
	workDirectory: string
	fromStep: Step
	stopAfterMix: boolean
}

type ResearchRecord = { usages: ResearchUsage[]; researchSeconds: number }

function startsBy(fromStep: Step, step: Step): boolean {
	return STEPS.indexOf(fromStep) <= STEPS.indexOf(step)
}

export async function readSavedBrief(
	workDirectory: string,
	listenerId: number,
	date: string
): Promise<DueListener> {
	const directory = episodeDirectory(workDirectory, listenerId, date)
	return dueListenerSchema.parse(await readJsonFile(join(directory, 'brief.json')))
}

async function readResearchRecord(directory: string): Promise<ResearchRecord> {
	const record = await readJsonFile(join(directory, 'research.json'))
	if (
		!record ||
		typeof record !== 'object' ||
		!('usages' in record) ||
		!Array.isArray(record.usages) ||
		!('researchSeconds' in record) ||
		typeof record.researchSeconds !== 'number'
	) {
		throw new Error(`research.json in ${directory} is malformed`)
	}
	return record as ResearchRecord
}

export function buildMetrics(
	research: ResearchRecord,
	episode: EpisodeScript,
	ttsUsdPerThousandCharacters: number
): EpisodeMetrics {
	const last = research.usages.at(-1)
	if (!last) throw new Error('no research usage recorded; a dry run episode cannot be saved')
	const sum = (pick: (usage: ResearchUsage) => number): number =>
		research.usages.reduce((total, usage) => total + pick(usage), 0)
	const characters = ttsCharacters(episode.turns)
	return {
		model: last.model,
		inputTokens: sum((usage) => usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens),
		outputTokens: sum((usage) => usage.outputTokens),
		webSearches: sum((usage) => usage.webSearches),
		webFetches: sum((usage) => usage.webFetches),
		ttsCharacters: characters,
		llmCostUsd: llmCostUsd(research.usages),
		ttsCostUsd: ttsCostUsd(characters, ttsUsdPerThousandCharacters),
		researchSeconds: Math.round(research.researchSeconds * 10) / 10,
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
			const record = await readResearchRecord(directory)
			const episode = episodeScriptSchema.parse(await readJsonFile(join(directory, 'episode.json')))
			return { ...record, episode }
		}
		await writeJsonFile(join(directory, 'brief.json'), listener)
		const written = await services.writer.write(listener, (attempt, reply) =>
			writeFile(join(directory, `reply-${attempt}.txt`), reply)
		)
		await writeJsonFile(join(directory, 'episode.json'), written.episode)
		const record: ResearchRecord = {
			usages: written.usages,
			researchSeconds: written.researchSeconds,
		}
		await writeJsonFile(join(directory, 'research.json'), record)
		log(`listener ${listenerId}: "${written.episode.title}", ${written.episode.storyCount} stories`)
		return { ...record, episode: written.episode }
	})
	const episode = research.episode

	const mixed = await (async () => {
		if (!startsBy(options.fromStep, 'mix')) {
			return inStep('mix', () => probeMix(join(directory, 'episode.mp3')))
		}
		const clips = await inStep('tts', () =>
			renderClips(episode.turns, join(directory, 'clips'), services.renderer)
		)
		return inStep('mix', () => mixEpisode(directory, episode.turns, clips, date))
	})()

	if (options.stopAfterMix) {
		log(`listener ${listenerId}: stopping after mix (${mixed.file})`)
		return
	}

	const audioUrl = await inStep('upload', async () => {
		const uploadFile = join(directory, 'upload.json')
		if (!startsBy(options.fromStep, 'upload')) {
			const saved = await readJsonFile(uploadFile)
			if (
				!saved ||
				typeof saved !== 'object' ||
				!('url' in saved) ||
				typeof saved.url !== 'string'
			) {
				throw new Error(`upload.json in ${directory} is malformed`)
			}
			return saved.url
		}
		const url = await uploadEpisode(services.jobs, listenerId, date, mixed)
		await writeJsonFile(uploadFile, { url })
		return url
	})

	await inStep('save', async () => {
		const response = await services.jobs.saveEpisode({
			...episode,
			listenerId,
			date,
			metrics: buildMetrics(research, episode, services.ttsUsdPerThousandCharacters),
			audioUrl,
			audioBytes: mixed.bytes,
			durationSeconds: mixed.durationSeconds,
		})
		log(`listener ${listenerId}: episode saved ${JSON.stringify(response)}`)
	})
}
