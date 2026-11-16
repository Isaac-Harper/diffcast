import { generateText, NoObjectGeneratedError, Output } from 'ai'
import type { ModelMessage, ProviderMetadata } from 'ai'
import { episodeScriptSchema } from '../../../shared/contract.ts'
import type { DueListener, EpisodeScript } from '../../../shared/contract.ts'
import { buildFixRequest, buildWriterInput } from './brief.ts'
import { roundUsd, sumCostUsd } from './gateway-cost.ts'
import { log } from './log.ts'
import { modelFacingSchema } from './model-schema.ts'
import { extractEpisodeJson } from './reply.ts'
import type { Gateway } from './research.ts'
import { normalizeUrl } from './research-notes.ts'
import type { SavedResearchNotes } from './research-notes.ts'
import { checkScript } from './script-rules.ts'
import { privateProjectNames } from './work-context.ts'
import type { ScriptCheck } from './script-rules.ts'
import { StepFailure } from './steps.ts'

const ATTEMPTS = 2
const WRITE_TIMEOUT_MS = 5 * 60 * 1000

export type WriteRecord = {
	model: string
	inputTokens: number
	outputTokens: number
	costUsd: number
	attempts: number
}

export type WrittenEpisode = { episode: EpisodeScript; record: WriteRecord }

export type ReplyRecorder = (attempt: number, reply: string) => Promise<void>

export type EpisodeWriter = {
	write(
		listener: DueListener,
		notes: SavedResearchNotes,
		recordReply: ReplyRecorder
	): Promise<WrittenEpisode>
}

export type WriterSettings = { gateway: Gateway; model: string; instructions: string }

export type WriterReply = {
	text: string
	inputTokens: number
	outputTokens: number
	providerMetadata: ProviderMetadata | undefined
}

export type WriterCall = (messages: ModelMessage[]) => Promise<WriterReply>

export function uncitedSources(episode: EpisodeScript, notes: SavedResearchNotes): string[] {
	const allowed = new Set(
		notes.stories.flatMap((story) => story.sources.map((source) => normalizeUrl(source.url)))
	)
	const problems: string[] = []
	episode.segments.forEach((segment, index) => {
		for (const source of segment.sources) {
			if (!allowed.has(normalizeUrl(source.url))) {
				problems.push(
					`segments.${index}.sources cites ${source.url}, which is not in the research notes; cite only sources listed there`
				)
			}
		}
	})
	return problems
}

export function checkReply(
	reply: string,
	listener: Pick<DueListener, 'minutes' | 'format' | 'workContext'>,
	notes: SavedResearchNotes
): ScriptCheck {
	let check: ScriptCheck
	try {
		check = checkScript(
			extractEpisodeJson(reply),
			listener.minutes,
			listener.format,
			privateProjectNames(listener.workContext)
		)
	} catch (error) {
		return { ok: false, problems: [error instanceof Error ? error.message : String(error)] }
	}
	if (!check.ok) return check
	const problems = uncitedSources(check.episode, notes)
	return problems.length ? { ok: false, problems } : check
}

export async function writeWithRetry(
	listener: DueListener,
	notes: SavedResearchNotes,
	model: string,
	call: WriterCall,
	recordReply: ReplyRecorder
): Promise<WrittenEpisode> {
	const messages: ModelMessage[] = [{ role: 'user', content: buildWriterInput(listener, notes) }]
	const replies: WriterReply[] = []
	let problems: string[] = []
	for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
		if (attempt > 1) messages.push({ role: 'user', content: buildFixRequest(problems) })
		log(`listener ${listener.listenerId}: writing with ${model} (attempt ${attempt})`)
		const reply = await call([...messages])
		replies.push(reply)
		await recordReply(attempt, reply.text)
		messages.push({ role: 'assistant', content: reply.text })
		const check = checkReply(reply.text, listener, notes)
		if (check.ok) {
			return {
				episode: check.episode,
				record: {
					model,
					inputTokens: replies.reduce((total, entry) => total + entry.inputTokens, 0),
					outputTokens: replies.reduce((total, entry) => total + entry.outputTokens, 0),
					costUsd: roundUsd(sumCostUsd(replies.map((entry) => entry.providerMetadata))),
					attempts: attempt,
				},
			}
		}
		problems = check.problems
		log(`listener ${listener.listenerId}: episode invalid: ${problems.join('; ')}`)
	}
	throw new StepFailure('validate', `episode invalid after retry: ${problems.join('; ')}`)
}

export function createGatewayWriterCall(settings: WriterSettings): WriterCall {
	return async (messages) => {
		let providerMetadata: ProviderMetadata | undefined
		try {
			const result = await generateText({
				model: settings.gateway(settings.model),
				instructions: settings.instructions,
				messages,
				output: Output.object({ schema: modelFacingSchema(episodeScriptSchema) }),
				reasoning: 'low',
				abortSignal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
				onLanguageModelCallEnd: (event) => {
					providerMetadata = event.providerMetadata
				},
			})
			return {
				text: JSON.stringify(result.output),
				inputTokens: result.totalUsage.inputTokens ?? 0,
				outputTokens: result.totalUsage.outputTokens ?? 0,
				providerMetadata,
			}
		} catch (error) {
			if (!NoObjectGeneratedError.isInstance(error) || error.text === undefined) throw error
			return {
				text: error.text,
				inputTokens: error.usage?.inputTokens ?? 0,
				outputTokens: error.usage?.outputTokens ?? 0,
				providerMetadata,
			}
		}
	}
}

export function createWriter(settings: WriterSettings): EpisodeWriter {
	const call = createGatewayWriterCall(settings)
	return {
		write: (listener, notes, recordReply) =>
			writeWithRetry(listener, notes, settings.model, call, recordReply),
	}
}
