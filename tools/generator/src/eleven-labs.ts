import { rename, rm, writeFile } from 'node:fs/promises'
import type { Turn } from '../../../shared/contract.ts'
import type { ClipRenderer } from './clips.ts'
import { log } from './log.ts'
import { jitter, sleep } from './timing.ts'

const TTS_TIMEOUT_MS = 120 * 1000
const TTS_BUDGET_MS = 5 * 60 * 1000

type Speaker = Turn['speaker']

export type ElevenLabsSettings = {
	apiKey: string
	model: string
	voices: Record<Speaker, string>
}

class PermanentTtsError extends Error {}

function apiMessage(status: number, text: string): string {
	let message = text.slice(0, 300)
	try {
		const body: unknown = JSON.parse(text)
		if (body && typeof body === 'object' && 'detail' in body) {
			const detail = body.detail
			if (typeof detail === 'string') message = detail
			else if (detail && typeof detail === 'object') {
				if ('message' in detail && typeof detail.message === 'string') message = detail.message
				else if ('status' in detail && typeof detail.status === 'string') message = detail.status
			}
		}
	} catch {
		return `elevenlabs answered ${status}: ${message}`
	}
	return `elevenlabs answered ${status}: ${message}${status === 401 ? ' (check ELEVENLABS_API_KEY or quota)' : ''}`
}

export async function synthesize(
	settings: ElevenLabsSettings,
	speaker: Speaker,
	text: string,
	previousText: string | undefined,
	nextText: string | undefined
): Promise<Buffer> {
	const url = `https://api.elevenlabs.io/v1/text-to-speech/${settings.voices[speaker]}?output_format=mp3_44100_128`
	const body = JSON.stringify({
		text,
		model_id: settings.model,
		...(previousText ? { previous_text: previousText } : {}),
		...(nextText ? { next_text: nextText } : {}),
	})
	const deadline = Date.now() + TTS_BUDGET_MS
	for (let attempt = 0; ; attempt++) {
		let failure: Error
		let retryAfterSeconds = 0
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'xi-api-key': settings.apiKey,
					'content-type': 'application/json',
					accept: 'audio/mpeg',
				},
				body,
				signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
			})
			if (response.ok) return Buffer.from(await response.arrayBuffer())
			const responseText = await response.text()
			if (response.status !== 429 && response.status < 500) {
				throw new PermanentTtsError(apiMessage(response.status, responseText))
			}
			failure = new Error(`elevenlabs answered ${response.status}: ${responseText.slice(0, 200)}`)
			retryAfterSeconds = Number(response.headers.get('retry-after')) || 0
		} catch (error) {
			if (error instanceof PermanentTtsError) throw error
			failure = error instanceof Error ? error : new Error(String(error))
		}
		const wait =
			retryAfterSeconds > 0
				? Math.min(retryAfterSeconds, 120) * 1000
				: jitter(Math.min(60_000, 2000 * 2 ** attempt))
		if (Date.now() + wait > deadline) {
			throw new Error(`${failure.message} (gave up after ${attempt + 1} attempts)`)
		}
		log(`elevenlabs: ${failure.message}, retrying in ${Math.round(wait / 1000)}s`)
		await sleep(wait)
	}
}

export function createElevenLabsRenderer(settings: ElevenLabsSettings): ClipRenderer {
	return {
		cacheKey: (speaker) => `${settings.voices[speaker]}\n${settings.model}`,
		async render(turns, index, outputPath) {
			const turn = turns[index]
			if (!turn) throw new Error(`no turn ${index}`)
			const audio = await synthesize(
				settings,
				turn.speaker,
				turn.text,
				turns[index - 1]?.text,
				turns[index + 1]?.text
			)
			await writeFile(`${outputPath}.part`, audio)
			await rm(outputPath, { force: true })
			await rename(`${outputPath}.part`, outputPath)
		},
	}
}
