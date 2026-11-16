import { createReadStream } from 'node:fs'
import { put } from '@vercel/blob/client'
import type { JobClient } from './job-api.ts'
import { log } from './log.ts'
import type { MixedEpisode } from './mix.ts'
import { jitter, sleep } from './timing.ts'

const UPLOAD_RETRIES = 2
const UPLOAD_TIMEOUT_MS = 20 * 60 * 1000

export async function uploadEpisode(
	jobs: JobClient,
	listenerId: number,
	date: string,
	mixed: MixedEpisode
): Promise<string> {
	for (let attempt = 0; ; attempt++) {
		try {
			const grant = await jobs.requestUpload(listenerId, date)
			const blob = await put(grant.pathname, createReadStream(mixed.file), {
				access: 'private',
				token: grant.clientToken,
				contentType: 'audio/mpeg',
				abortSignal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
			})
			log(`uploaded ${blob.pathname}`)
			return blob.url
		} catch (error) {
			if (attempt >= UPLOAD_RETRIES) throw error
			const wait = jitter(5000 * 2 ** attempt)
			const message = error instanceof Error ? error.message : String(error)
			log(`upload failed (${message}), retrying in ${Math.round(wait / 1000)}s`)
			await sleep(wait)
		}
	}
}
