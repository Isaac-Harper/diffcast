import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DueListener } from '../../../shared/contract.ts'
import type { RunOptions } from './arguments.ts'
import { createGateway } from 'ai'
import { createSilentRenderer } from './clips.ts'
import { loadGatewayConfig, loadJobApiConfig, loadLiveConfig } from './config.ts'
import type { GatewayConfig } from './config.ts'
import { createFixtureResearcher, createFixtureWriter } from './fixture-stages.ts'
import { createFixtureJobClient, createHttpJobClient } from './job-api.ts'
import type { JobClient } from './job-api.ts'
import { readSavedBrief } from './pipeline.ts'
import type { PipelineServices } from './pipeline.ts'
import { createResearcher } from './research.ts'
import { createSpeechRenderer } from './speech.ts'
import { uploadEpisode } from './upload.ts'
import { createWriter } from './writer.ts'

export const SMOKE_MODEL = 'smoke'

const PACKAGE_DIRECTORY = dirname(dirname(fileURLToPath(import.meta.url)))
const FIXTURE_EPISODE = join(PACKAGE_DIRECTORY, 'fixtures', 'episode.json')
const SAMPLE_DUE = join(PACKAGE_DIRECTORY, 'fixtures', 'sample-due.json')
const FIXTURE_NOTES = join(PACKAGE_DIRECTORY, 'fixtures', 'research-notes.json')

type Environment = Record<string, string | undefined>

function refuseUpload(): Promise<string> {
	throw new Error('a dry run never uploads')
}

export async function createServices(
	options: RunOptions,
	environment: Environment
): Promise<PipelineServices> {
	if (options.dryRun) {
		return {
			jobs: createFixtureJobClient(join(PACKAGE_DIRECTORY, 'fixtures', 'due.json')),
			researcher: createFixtureResearcher(FIXTURE_NOTES),
			writer: createFixtureWriter(FIXTURE_EPISODE),
			renderer: createSilentRenderer(),
			upload: refuseUpload,
			metrics: { kind: 'zeroed', model: 'dry-run' },
		}
	}
	if (options.smoke) {
		const config = loadJobApiConfig(environment)
		const jobs = createHttpJobClient({ url: config.jobUrl, token: config.jobToken })
		return {
			jobs,
			researcher: createFixtureResearcher(FIXTURE_NOTES),
			writer: createFixtureWriter(FIXTURE_EPISODE),
			renderer: createSilentRenderer(),
			upload: (listenerId, date, mixed) => uploadEpisode(jobs, listenerId, date, mixed),
			metrics: { kind: 'zeroed', model: SMOKE_MODEL },
		}
	}
	if (options.sample) {
		return {
			jobs: createFixtureJobClient(SAMPLE_DUE),
			...(await createGatewayStages(loadGatewayConfig(environment))),
			upload: refuseUpload,
			metrics: { kind: 'measured' },
		}
	}
	const config = loadLiveConfig(environment)
	const jobs = createHttpJobClient({ url: config.jobUrl, token: config.jobToken })
	return {
		jobs,
		...(await createGatewayStages(config)),
		upload: (listenerId, date, mixed) => uploadEpisode(jobs, listenerId, date, mixed),
		metrics: { kind: 'measured' },
	}
}

async function createGatewayStages(
	config: GatewayConfig
): Promise<Pick<PipelineServices, 'researcher' | 'writer' | 'renderer'>> {
	const gateway = createGateway({ apiKey: config.gatewayApiKey })
	const prompt = (name: string) => readFile(join(PACKAGE_DIRECTORY, name), 'utf8')
	return {
		researcher: createResearcher({
			gateway,
			model: config.researchModel,
			instructions: await prompt('research-prompt.md'),
		}),
		writer: createWriter({
			gateway,
			model: config.writerModel,
			instructions: await prompt('writer-prompt.md'),
		}),
		renderer: createSpeechRenderer({
			gateway,
			model: config.ttsModel,
			voices: { host: config.hostVoice, cohost: config.cohostVoice },
		}),
	}
}

function losAngelesToday(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

export async function selectListeners(
	options: RunOptions,
	jobs: JobClient,
	workDirectory: string
): Promise<DueListener[]> {
	if (options.fromStep !== null && options.listenerId !== null && options.date !== null) {
		return [await readSavedBrief(workDirectory, options.listenerId, options.date)]
	}
	if (options.sample) {
		const date = options.date ?? losAngelesToday()
		return (await jobs.fetchDue(null)).map((listener) => ({ ...listener, date }))
	}
	const due = await jobs.fetchDue(options.now)
	const chosen =
		options.listenerId === null
			? due
			: due.filter((listener) => listener.listenerId === options.listenerId)
	if (options.listenerId !== null && chosen.length === 0) {
		throw new Error(`listener ${options.listenerId} is not due; use --now or --from-step`)
	}
	const date = options.date
	return date === null ? chosen : chosen.map((listener) => ({ ...listener, date }))
}
