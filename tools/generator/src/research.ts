import { createGateway, generateText, isStepCount, Output, tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'
import type { DueListener } from '../../../shared/contract.ts'
import { buildBrief, windowStart } from './brief.ts'
import { roundUsd, sumCostUsd } from './gateway-cost.ts'
import { fetchPage } from './fetch-page.ts'
import type { FetchedPage } from './fetch-page.ts'
import { log } from './log.ts'
import { modelFacingSchema } from './model-schema.ts'
import { reconcileNotes, researchNotesSchema } from './research-notes.ts'
import type { SavedResearchNotes, Source } from './research-notes.ts'

export const MAX_SEARCHES = 12
export const MAX_FETCHES = 15
export const MAX_STEPS = 32
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
	stepNumber: number
): ('parallel_search' | 'fetch_page')[] {
	if (stepNumber >= MAX_STEPS - 1) return []
	const active: ('parallel_search' | 'fetch_page')[] = []
	if (budget.searches < MAX_SEARCHES) active.push('parallel_search')
	if (budget.fetches < MAX_FETCHES) active.push('fetch_page')
	return active
}

export async function fetchWithinBudget(
	budget: ToolBudget,
	fetched: Source[],
	fetcher: PageFetcher,
	url: string
): Promise<FetchedPage> {
	if (budget.fetches >= MAX_FETCHES) {
		throw new Error(`fetch limit of ${MAX_FETCHES} reached; write the notes from what you have`)
	}
	budget.fetches++
	const page = await fetcher(url)
	const title = page.title.slice(0, 300)
	fetched.push({ title, url: page.url })
	if (page.url !== url) fetched.push({ title, url })
	return page
}

function createFetchPageTool(budget: ToolBudget, fetched: Source[], fetcher: PageFetcher) {
	return tool({
		description: `Fetch one web page and return its readable text, cut to about 6000 characters. Read a source with this before relying on it. At most ${MAX_FETCHES} fetches per episode.`,
		inputSchema: z.object({ url: z.string().describe('The http or https url to read') }),
		execute: ({ url }) => fetchWithinBudget(budget, fetched, fetcher, url),
	})
}

function countSearches(toolCalls: { toolName: string }[]): number {
	return toolCalls.filter((call) => call.toolName === 'parallel_search').length
}

export function createResearcher(
	settings: ResearchSettings,
	fetcher: PageFetcher = fetchPage
): Researcher {
	return {
		async research(listener) {
			const started = Date.now()
			const budget: ToolBudget = { searches: 0, fetches: 0 }
			const fetched: Source[] = []
			const tools = {
				parallel_search: settings.gateway.tools.parallelSearch({
					maxResults: 8,
					excerpts: { maxCharsPerResult: 1200 },
					sourcePolicy: { afterDate: windowStart(listener.date) },
				}),
				fetch_page: createFetchPageTool(budget, fetched, fetcher),
			} satisfies ToolSet
			log(`listener ${listener.listenerId}: researching with ${settings.model}`)
			const result = await generateText({
				model: settings.gateway(settings.model),
				instructions: settings.instructions,
				prompt: buildBrief(listener),
				tools,
				output: Output.object({ schema: modelFacingSchema(researchNotesSchema) }),
				stopWhen: isStepCount(MAX_STEPS),
				prepareStep: ({ stepNumber }) => ({ activeTools: activeResearchTools(budget, stepNumber) }),
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
