import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DueListener } from '../../../shared/contract.ts'
import { parseRunOptions } from './arguments.ts'
import type { RunOptions } from './arguments.ts'
import { createClaudeWriter } from './claude-writer.ts'
import { createSilentRenderer } from './clips.ts'
import { loadLiveConfig, workDirectoryFrom } from './config.ts'
import { runListeners } from './due-loop.ts'
import { createElevenLabsRenderer } from './eleven-labs.ts'
import { createFixtureWriter } from './fixture-writer.ts'
import { createFixtureJobClient, createHttpJobClient } from './job-api.ts'
import type { JobClient } from './job-api.ts'
import { acquireLock, releaseLock } from './lock.ts'
import { log } from './log.ts'
import { produceEpisode, readSavedBrief } from './pipeline.ts'
import type { PipelineServices } from './pipeline.ts'
import { pruneWorkDirectory } from './prune.ts'
import { ensureDirectory } from './work-directory.ts'

const PACKAGE_DIRECTORY = dirname(dirname(fileURLToPath(import.meta.url)))

async function createServices(options: RunOptions): Promise<PipelineServices> {
	if (options.dryRun) {
		return {
			jobs: createFixtureJobClient(join(PACKAGE_DIRECTORY, 'fixtures', 'due.json')),
			writer: createFixtureWriter(join(PACKAGE_DIRECTORY, 'fixtures', 'episode.json')),
			renderer: createSilentRenderer(),
			ttsUsdPerThousandCharacters: 0,
		}
	}
	const config = loadLiveConfig(process.env)
	return {
		jobs: createHttpJobClient({ url: config.jobUrl, token: config.jobToken }),
		writer: createClaudeWriter({
			apiKey: config.anthropicApiKey,
			model: config.model,
			systemPrompt: await readFile(join(PACKAGE_DIRECTORY, 'prompt.md'), 'utf8'),
		}),
		renderer: createElevenLabsRenderer({
			apiKey: config.elevenLabsApiKey,
			model: config.ttsModel,
			voices: { host: config.hostVoice, cohost: config.cohostVoice },
		}),
		ttsUsdPerThousandCharacters: config.ttsUsdPerThousandCharacters,
	}
}

async function selectListeners(
	options: RunOptions,
	jobs: JobClient,
	workDirectory: string
): Promise<DueListener[]> {
	if (options.fromStep !== null && options.listenerId !== null && options.date !== null) {
		return [await readSavedBrief(workDirectory, options.listenerId, options.date)]
	}
	const due = await jobs.fetchDue(options.now)
	const chosen =
		options.listenerId === null
			? due
			: due.filter((listener) => listener.listenerId === options.listenerId)
	if (options.listenerId !== null && chosen.length === 0) {
		throw new Error(`listener ${options.listenerId} is not due; use --now or --from-step`)
	}
	return options.date === null
		? chosen
		: chosen.map((listener) => ({ ...listener, date: options.date ?? listener.date }))
}

async function main(): Promise<void> {
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.on(signal, () => {
			log(`${signal} received`)
			releaseLock()
			process.exit(1)
		})
	}
	try {
		const options = parseRunOptions(process.argv.slice(2))
		const workDirectory = workDirectoryFrom(process.env)
		const services = await createServices(options)
		await ensureDirectory(workDirectory)
		await acquireLock(join(workDirectory, '.lock'))
		const listeners = await selectListeners(options, services.jobs, workDirectory)
		log(`${listeners.length} listener(s) to produce`)
		const result = await runListeners(
			listeners,
			(listener) =>
				produceEpisode(listener, services, {
					workDirectory,
					fromStep: options.fromStep ?? 'research',
					stopAfterMix: options.dryRun || options.noUpload,
				}),
			services.jobs
		)
		await pruneWorkDirectory(workDirectory, Date.now()).catch((error: unknown) =>
			log(`warning: prune failed: ${error instanceof Error ? error.message : String(error)}`)
		)
		log(`done: ${result.succeeded.length} ok, ${result.failed.length} failed`)
		if (result.failed.length) process.exitCode = 1
	} catch (error) {
		log(`FAILED: ${error instanceof Error ? error.message : String(error)}`)
		process.exitCode = 1
	} finally {
		releaseLock()
	}
}

await main()
