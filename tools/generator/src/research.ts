import { createGateway, generateText, isStepCount, Output, tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'
import type { DueListener, EpisodeFormat } from '../../../shared/contract.ts'
import { buildBrief, windowStart } from './brief.ts'
import { roundUsd, sumCostUsd } from './gateway-cost.ts'
import { fetchPage } from './fetch-page.ts'
import type { FetchedPage } from './fetch-page.ts'
import { log } from './log.ts'
import { modelFacingSchema } from './model-schema.ts'
import { reconcileNotes, researchNotesSchema } from './research-notes.ts'
import type { SavedResearchNotes, Source } from './research-notes.ts'

export type ResearchLimits = { searches: number; fetches: number; steps: number }

export const RESEARCH_LIMITS: Record<EpisodeFormat, ResearchLimits> = {
	daily: { searches: 12, fetches: 15, steps: 32 },
	weekly_recap: { searches: 10, fetches: 12, steps: 26 },
	week_ahead: { searches: 5, fetches: 6, steps: 14 },
}
const RESEARCH_TIMEOUT_MS = 15 * 60 * 1000

export type Gateway = ReturnType<typeof createGateway>

export type ResearchRecord = {
	model: string
	inputTokens: number
	outputTokens: number
	costUsd: number
	webSearches: number
	webFetches: number
	researchSeconds: number
}

export type ResearchResult = { notes: SavedResearchNotes; record: ResearchRecord }

export type Researcher = { research(listener: DueListener): Promise<ResearchResult> }

export type ResearchSettings = { gateway: Gateway; model: string; instructions: string }

export type PageFetcher = (url: string) => Promise<FetchedPage>

export type ToolBudget = { searches: number; fetches: number }

export function activeResearchTools(
	budget: ToolBudget,
	limits: ResearchLimits,
	stepNumber: number
): ('parallel_search' | 'fetch_page')[] {
	if (stepNumber >= limits.steps - 1) return []
	const active: ('parallel_search' | 'fetch_page')[] = []
	if (budget.searches < limits.searches) active.push('parallel_search')
	if (budget.fetches < limits.fetches) active.push('fetch_page')
	return active
}

export async function fetchWithinBudget(
	budget: ToolBudget,
	limits: ResearchLimits,
	fetched: Source[],
	fetcher: PageFetcher,
	url: string
): Promise<FetchedPage> {
	if (budget.fetches >= limits.fetches) {
		throw new Error(`fetch limit of ${limits.fetches} reached; write the notes from what you have`)
	}
	budget.fetches++
	const page = await fetcher(url)
	const title = page.title.slice(0, 300)
	fetched.push({ title, url: page.url })
	if (page.url !== url) fetched.push({ title, url })
	return page
}

function createFetchPageTool(
	budget: ToolBudget,
	limits: ResearchLimits,
	fetched: Source[],
	fetcher: PageFetcher
) {
	return tool({
		description: `Fetch one web page and return its readable text, cut to about 6000 characters. Read a source with this before relying on it. At most ${limits.fetches} fetches per episode.`,
		inputSchema: z.object({ url: z.string().describe('The http or https url to read') }),
		execute: ({ url }) => fetchWithinBudget(budget, limits, fetched, fetcher, url),
	})
}

function countSearches(toolCalls: { toolName: string }[]): number {
	return toolCalls.filter((call) => call.toolName === 'parallel_search').length
}

export function buildResearchInput(listener: DueListener, limits: ResearchLimits): string {
	return [
		`Tool budget for this ${listener.format} episode: at most ${limits.searches} searches and ${limits.fetches} fetches. Plan them before you start.`,
		'',
		buildBrief(listener),
	].join('\n')
}

export function createResearcher(
	settings: ResearchSettings,
	fetcher: PageFetcher = fetchPage
): Researcher {
	return {
		async research(listener) {
			const started = Date.now()
			const budget: ToolBudget = { searches: 0, fetches: 0 }
			const limits = RESEARCH_LIMITS[listener.format]
			const fetched: Source[] = []
			const tools = {
				parallel_search: settings.gateway.tools.parallelSearch({
					maxResults: 8,
					excerpts: { maxCharsPerResult: 1200 },
					sourcePolicy: { afterDate: windowStart(listener) },
				}),
				fetch_page: createFetchPageTool(budget, limits, fetched, fetcher),
			} satisfies ToolSet
			log(
				`listener ${listener.listenerId}: researching ${listener.format} with ${settings.model} (at most ${limits.searches} searches, ${limits.fetches} fetches)`
			)
			const result = await generateText({
				model: settings.gateway(settings.model),
				instructions: settings.instructions,
				prompt: buildResearchInput(listener, limits),
				tools,
				output: Output.object({ schema: modelFacingSchema(researchNotesSchema) }),
				stopWhen: isStepCount(limits.steps),
				prepareStep: ({ stepNumber }) => ({
					activeTools: activeResearchTools(budget, limits, stepNumber),
				}),
				onStepEnd: (step) => {
					budget.searches += countSearches(step.toolCalls)
				},
				abortSignal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
			})
			const notes = reconcileNotes(researchNotesSchema.parse(result.output), fetched)
			const record: ResearchRecord = {
				model: settings.model,
				inputTokens: result.totalUsage.inputTokens ?? 0,
				outputTokens: result.totalUsage.outputTokens ?? 0,
				costUsd: roundUsd(sumCostUsd(result.steps.map((step) => step.providerMetadata))),
				webSearches: budget.searches,
				webFetches: budget.fetches,
				researchSeconds: (Date.now() - started) / 1000,
			}
			log(
				`listener ${listener.listenerId}: research found ${notes.stories.length} stories (${record.webSearches} searches, ${record.webFetches} fetches, $${record.costUsd})`
			)
			return { notes, record }
		},
	}
}
