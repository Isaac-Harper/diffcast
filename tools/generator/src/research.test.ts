import { describe, expect, it } from 'vitest'
import {
	activeResearchTools,
	fetchWithinBudget,
	MAX_FETCHES,
	MAX_SEARCHES,
	MAX_STEPS,
} from './research.ts'
import type { ToolBudget } from './research.ts'
import { reconcileNotes } from './research-notes.ts'
import type { ResearchNotes, Source } from './research-notes.ts'

describe('activeResearchTools', () => {
	it('offers both tools under budget', () => {
		expect(activeResearchTools({ searches: 0, fetches: 0 }, 0)).toEqual([
			'parallel_search',
			'fetch_page',
		])
	})

	it('drops each tool at its cap and both on the last step', () => {
		expect(activeResearchTools({ searches: MAX_SEARCHES, fetches: 3 }, 5)).toEqual(['fetch_page'])
		expect(activeResearchTools({ searches: 2, fetches: MAX_FETCHES }, 5)).toEqual([
			'parallel_search',
		])
		expect(activeResearchTools({ searches: 0, fetches: 0 }, MAX_STEPS - 1)).toEqual([])
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
		await fetchWithinBudget(budget, fetched, fetcher, 'http://example.com/a')
		expect(fetched).toEqual([
			{ title: 'Page', url: 'https://example.com/a' },
			{ title: 'Page', url: 'http://example.com/a' },
		])
		budget.fetches = MAX_FETCHES
		await expect(
			fetchWithinBudget(budget, fetched, fetcher, 'https://example.com/b')
		).rejects.toThrow('fetch limit')
		expect(budget.fetches).toBe(MAX_FETCHES)
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
