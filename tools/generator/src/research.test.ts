import { describe, expect, it } from 'vitest'
import type { DueListener } from '../../../shared/contract.ts'
import {
	activeResearchTools,
	buildResearchInput,
	fetchWithinBudget,
	RESEARCH_LIMITS,
} from './research.ts'
import type { ToolBudget } from './research.ts'
import { reconcileNotes } from './research-notes.ts'
import type { ResearchNotes, Source } from './research-notes.ts'

const DAILY = RESEARCH_LIMITS.daily
const WEEK_AHEAD = RESEARCH_LIMITS.week_ahead

describe('research limits', () => {
	it('spends less on the weekend formats', () => {
		expect(RESEARCH_LIMITS).toEqual({
			daily: { searches: 12, fetches: 15, steps: 32 },
			weekly_recap: { searches: 10, fetches: 12, steps: 26 },
			week_ahead: { searches: 5, fetches: 6, steps: 14 },
		})
	})

	it('states the budget at the top of the research input', () => {
		const listener: DueListener = {
			listenerId: 1,
			date: '2026-11-22',
			format: 'week_ahead',
			since: '2026-11-21',
			timezone: 'UTC',
			minutes: 10,
			stack: [],
			focus: '',
			interests: [],
			recent: [],
			feedback: [],
			workContext: [],
		}
		const input = buildResearchInput(listener, WEEK_AHEAD)
		expect(input.split('\n')[0]).toBe(
			'Tool budget for this week_ahead episode: at most 5 searches and 6 fetches. Plan them before you start.'
		)
		expect(input).toContain('Format: week_ahead')
	})
})

describe('activeResearchTools', () => {
	it('offers both tools under budget', () => {
		expect(activeResearchTools({ searches: 0, fetches: 0 }, DAILY, 0)).toEqual([
			'parallel_search',
			'fetch_page',
		])
	})

	it('drops each tool at its cap and both on the last step', () => {
		expect(activeResearchTools({ searches: DAILY.searches, fetches: 3 }, DAILY, 5)).toEqual([
			'fetch_page',
		])
		expect(activeResearchTools({ searches: 2, fetches: DAILY.fetches }, DAILY, 5)).toEqual([
			'parallel_search',
		])
		expect(activeResearchTools({ searches: 0, fetches: 0 }, DAILY, DAILY.steps - 1)).toEqual([])
	})

	it('applies the week ahead caps', () => {
		expect(activeResearchTools({ searches: 5, fetches: 5 }, WEEK_AHEAD, 3)).toEqual(['fetch_page'])
		expect(activeResearchTools({ searches: 5, fetches: 5 }, DAILY, 3)).toEqual([
			'parallel_search',
			'fetch_page',
		])
		expect(activeResearchTools({ searches: 0, fetches: 0 }, WEEK_AHEAD, 13)).toEqual([])
	})
})

describe('fetchWithinBudget', () => {
	it('records fetched pages, including the redirect source, and stops at the cap', async () => {
		const budget: ToolBudget = { searches: 0, fetches: 0 }
		const fetched: Source[] = []
		const fetcher = async (url: string) => ({
			url: url.replace('http:', 'https:'),
			title: 'Page',
			text: 'text',
			truncated: false,
		})
		await fetchWithinBudget(budget, WEEK_AHEAD, fetched, fetcher, 'http://example.com/a')
		expect(fetched).toEqual([
			{ title: 'Page', url: 'https://example.com/a' },
			{ title: 'Page', url: 'http://example.com/a' },
		])
		budget.fetches = WEEK_AHEAD.fetches
		await expect(
			fetchWithinBudget(budget, WEEK_AHEAD, fetched, fetcher, 'https://example.com/b')
		).rejects.toThrow('fetch limit of 6')
		expect(budget.fetches).toBe(WEEK_AHEAD.fetches)
	})
})

function story(urls: string[]) {
	return {
		headline: `Story ${urls.join(' ')}`,
		whatHappened: 'Something happened.',
		whyItMatters: 'It matters.',
		dates: '2026-11-15',
		interests: ['Open source'],
		packages: [],
		kind: 'news' as const,
		challenges: null,
		sources: urls.map((url) => ({ title: 'Source', url })),
	}
}

describe('reconcileNotes', () => {
	it('keeps only fetched sources and drops stories left without one', () => {
		const notes: ResearchNotes = {
			stories: [
				story(['https://example.com/a#section', 'https://example.com/never']),
				story(['https://example.com/unfetched']),
			],
			quietDay: '',
		}
		const fetched = [{ title: 'A', url: 'https://example.com/a/' }]
		const reconciled = reconcileNotes(notes, fetched)
		expect(reconciled.stories).toHaveLength(1)
		expect(reconciled.stories[0]?.sources).toEqual([
			{ title: 'Source', url: 'https://example.com/a#section' },
		])
		expect(reconciled.fetched).toEqual(fetched)
	})
})
