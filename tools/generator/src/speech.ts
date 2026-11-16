import { rename, rm, writeFile } from 'node:fs/promises'
import { APICallError, generateSpeech } from 'ai'
import type { Turn } from '../../../shared/contract.ts'
import type { ClipRenderer } from './clips.ts'
import { gatewayCostUsd } from './gateway-cost.ts'
import { log } from './log.ts'
import type { Gateway } from './research.ts'
import { jitter, sleep } from './timing.ts'

const TTS_TIMEOUT_MS = 120 * 1000
const TTS_BUDGET_MS = 5 * 60 * 1000

type Speaker = Turn['speaker']

export type SpeechSettings = { gateway: Gateway; model: string; voices: Record<Speaker, string> }

export type SpokenClip = { audio: Uint8Array; costUsd: number }

class PermanentTtsError extends Error {}

function retryAfterSeconds(error: APICallError): number {
	return Number(error.responseHeaders?.['retry-after']) || 0
}

export async function synthesize(
	settings: SpeechSettings,
	speaker: Speaker,
	text: string
): Promise<SpokenClip> {
	const deadline = Date.now() + TTS_BUDGET_MS
	for (let attempt = 0; ; attempt++) {
		let failure: Error
		let waitSeconds = 0
		try {
			const result = await generateSpeech({
				model: settings.gateway.speech(settings.model),
				text,
				voice: settings.voices[speaker],
				outputFormat: 'mp3',
				maxRetries: 0,
				abortSignal: AbortSignal.timeout(TTS_TIMEOUT_MS),
			})
			return { audio: result.audio.uint8Array, costUsd: gatewayCostUsd(result.providerMetadata) }
		} catch (error) {
			if (APICallError.isInstance(error)) {
				const status = error.statusCode ?? 0
				if (!error.isRetryable && status !== 429 && status < 500 && status !== 0) {
					throw new PermanentTtsError(`speech answered ${status}: ${error.message.slice(0, 300)}`)
				}
				waitSeconds = retryAfterSeconds(error)
			}
			if (error instanceof PermanentTtsError) throw error
			failure = error instanceof Error ? error : new Error(String(error))
		}
		const wait =
			waitSeconds > 0
				? Math.min(waitSeconds, 120) * 1000
				: jitter(Math.min(60_000, 2000 * 2 ** attempt))
		if (Date.now() + wait > deadline) {
			throw new Error(`${failure.message} (gave up after ${attempt + 1} attempts)`)
		}
		log(`speech: ${failure.message}, retrying in ${Math.round(wait / 1000)}s`)
		await sleep(wait)
	}
}

export function createSpeechRenderer(settings: SpeechSettings): ClipRenderer {
	return {
		cacheKey: (speaker) => `${settings.model}\n${settings.voices[speaker]}`,
		async render(turns, index, outputPath) {
			const turn = turns[index]
			if (!turn) throw new Error(`no turn ${index}`)
			const clip = await synthesize(settings, turn.speaker, turn.text)
			await writeFile(`${outputPath}.part`, clip.audio)
			await rm(outputPath, { force: true })
			await rename(`${outputPath}.part`, outputPath)
			return clip.costUsd
		},
	}
}
