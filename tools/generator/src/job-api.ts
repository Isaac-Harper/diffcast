import { readFile } from 'node:fs/promises'
import {
	dueResponseSchema,
	episodeRequestSchema,
	failureRequestSchema,
	uploadRequestSchema,
	uploadResponseSchema,
} from '../../../shared/contract.ts'
import type { DueListener, EpisodeRequest, FailureRequest } from '../../../shared/contract.ts'
import { log } from './log.ts'
import { jitter, sleep } from './timing.ts'

const API_TIMEOUT_MS = 30 * 1000
const API_RETRIES = 3

export type UploadGrant = { pathname: string; clientToken: string }

export type JobClient = {
	fetchDue(now: string | null): Promise<DueListener[]>
	requestUpload(listenerId: number, date: string): Promise<UploadGrant>
	saveEpisode(request: EpisodeRequest): Promise<unknown>
	reportFailure(request: FailureRequest): Promise<void>
}

export type JobApiSettings = { url: string; token: string }

async function callJobApi(
	settings: JobApiSettings,
	path: string,
	body?: unknown
): Promise<unknown> {
	for (let attempt = 0; ; attempt++) {
		let failure: Error
		let permanent = false
		try {
			const response = await fetch(new URL(path, settings.url), {
				method: body === undefined ? 'GET' : 'POST',
				headers: {
					authorization: `Bearer ${settings.token}`,
					...(body === undefined ? {} : { 'content-type': 'application/json' }),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(API_TIMEOUT_MS),
			})
			const text = await response.text()
			if (response.ok) return text ? JSON.parse(text) : {}
			failure = new Error(`${path} answered ${response.status}: ${text.slice(0, 300)}`)
			permanent = response.status < 500
		} catch (error) {
			failure = error instanceof Error ? error : new Error(String(error))
		}
		if (permanent || attempt >= API_RETRIES) throw failure
		const wait = jitter(1000 * 2 ** attempt)
		log(`${path} failed (${failure.message}), retrying in ${Math.round(wait / 1000)}s`)
		await sleep(wait)
	}
}

export function createHttpJobClient(settings: JobApiSettings): JobClient {
	return {
		async fetchDue(now) {
			const path = now ? `/api/jobs/due?now=${encodeURIComponent(now)}` : '/api/jobs/due'
			return dueResponseSchema.parse(await callJobApi(settings, path)).listeners
		},
		async requestUpload(listenerId, date) {
			const body = uploadRequestSchema.parse({ listenerId, date })
			return uploadResponseSchema.parse(await callJobApi(settings, '/api/jobs/upload', body))
		},
		async saveEpisode(request) {
			return callJobApi(settings, '/api/jobs/episodes', episodeRequestSchema.parse(request))
		},
		async reportFailure(request) {
			await callJobApi(settings, '/api/jobs/failures', failureRequestSchema.parse(request))
		},
	}
}

export function createFixtureJobClient(duePath: string): JobClient {
	const refuse = (): never => {
		throw new Error('a dry run never calls the job API')
	}
	return {
		async fetchDue() {
			return dueResponseSchema.parse(JSON.parse(await readFile(duePath, 'utf8'))).listeners
		},
		requestUpload: async () => refuse(),
		saveEpisode: async () => refuse(),
		async reportFailure(request) {
			log(`dry run: not reporting ${request.step} failure for listener ${request.listenerId}`)
		},
	}
}
