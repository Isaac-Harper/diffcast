import Anthropic from '@anthropic-ai/sdk'
import type { DueListener } from '../../../shared/contract.ts'
import { buildBrief, buildFixRequest } from './brief.ts'
import { log } from './log.ts'
import type { ResearchUsage } from './pricing.ts'
import { extractEpisodeJson } from './reply.ts'
import { checkScript } from './script-rules.ts'
import type { ScriptCheck } from './script-rules.ts'
import type { ReplyRecorder, ScriptWriter, WrittenScript } from './script-writer.ts'
import { StepFailure } from './steps.ts'

const MAX_TOKENS = 64_000
const MAX_WEB_SEARCHES = 15
const MAX_WEB_FETCHES = 25
const MAX_CONTINUATIONS = 8
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const ATTEMPTS = 2
const GATEWAY_URL = 'https://ai-gateway.vercel.sh'

type Conversation = Anthropic.Beta.BetaMessageParam[]

export type ClaudeWriterSettings = { apiKey: string; model: string; systemPrompt: string }

function usageOf(message: Anthropic.Beta.BetaMessage): ResearchUsage {
	const usage = message.usage
	return {
		model: message.model,
		inputTokens: usage.input_tokens,
		outputTokens: usage.output_tokens,
		cacheReadTokens: usage.cache_read_input_tokens ?? 0,
		cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
		webSearches: usage.server_tool_use?.web_search_requests ?? 0,
		webFetches: usage.server_tool_use?.web_fetch_requests ?? 0,
	}
}

export function finalReplyText(content: Anthropic.Beta.BetaContentBlock[]): string {
	const lastNonText = content.findLastIndex((block) => block.type !== 'text')
	const text = content
		.slice(lastNonText + 1)
		.map((block) => (block.type === 'text' ? block.text : ''))
		.join('')
		.trim()
	if (!text) throw new Error('research ended without a text reply')
	return text
}

function checkReply(reply: string, minutes: number): ScriptCheck {
	try {
		return checkScript(extractEpisodeJson(reply), minutes)
	} catch (error) {
		return { ok: false, problems: [error instanceof Error ? error.message : String(error)] }
	}
}

export function createClaudeWriter(settings: ClaudeWriterSettings): ScriptWriter {
	const client = new Anthropic({
		apiKey: settings.apiKey,
		baseURL: GATEWAY_URL,
		timeout: REQUEST_TIMEOUT_MS,
	})

	async function converse(conversation: Conversation, usages: ResearchUsage[]): Promise<string> {
		for (let continuation = 0; continuation <= MAX_CONTINUATIONS; continuation++) {
			const message = await client.beta.messages
				.stream({
					model: settings.model,
					max_tokens: MAX_TOKENS,
					betas: ['server-side-fallback-2026-07-01'],
					fallbacks: 'default',
					cache_control: { type: 'ephemeral' },
					system: settings.systemPrompt,
					tools: [
						{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_WEB_SEARCHES },
						{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: MAX_WEB_FETCHES },
					],
					messages: conversation,
				})
				.finalMessage()
			usages.push(usageOf(message))
			conversation.push({ role: 'assistant', content: message.content })
			if (message.stop_reason === 'pause_turn') continue
			if (message.stop_reason !== 'end_turn') {
				const detail = message.stop_details ? ` (${JSON.stringify(message.stop_details)})` : ''
				throw new Error(`research stopped with ${message.stop_reason}${detail}`)
			}
			return finalReplyText(message.content)
		}
		throw new Error(`research still paused after ${MAX_CONTINUATIONS} continuations`)
	}

	return {
		async write(listener: DueListener, recordReply: ReplyRecorder): Promise<WrittenScript> {
			const started = Date.now()
			const usages: ResearchUsage[] = []
			const conversation: Conversation = [{ role: 'user', content: buildBrief(listener) }]
			let problems: string[] = []
			for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
				if (attempt > 1) conversation.push({ role: 'user', content: buildFixRequest(problems) })
				log(`listener ${listener.listenerId}: researching and writing (attempt ${attempt})`)
				const reply = await converse(conversation, usages)
				await recordReply(attempt, reply)
				const check = checkReply(reply, listener.minutes)
				if (check.ok) {
					return { episode: check.episode, usages, researchSeconds: (Date.now() - started) / 1000 }
				}
				problems = check.problems
				log(`listener ${listener.listenerId}: episode invalid: ${problems.join('; ')}`)
			}
			throw new StepFailure('validate', `episode invalid after retry: ${problems.join('; ')}`)
		},
	}
}
