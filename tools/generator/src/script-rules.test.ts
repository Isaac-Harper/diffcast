import { describe, expect, it } from 'vitest'
import { checkScript, removeDashes, wordRange } from './script-rules.ts'

function words(count: number): string {
	return Array.from({ length: count }, () => 'word').join(' ')
}

function script(overrides: Record<string, unknown> = {}, turnWords: number[] = [100, 100]) {
	return {
		title: 'Title',
		summary: 'Summary.',
		storyCount: 1,
		segments: [
			{
				heading: 'Heading',
				kind: 'news',
				challenges: null,
				topics: ['Developer tools and web development'],
				packages: ['zod'],
				sources: [{ title: 'Notes', url: 'https://example.com' }],
			},
		],
		turns: turnWords.map((count, index) => ({
			speaker: index % 2 ? 'cohost' : 'host',
			text: words(count),
		})),
		...overrides,
	}
}

describe('wordRange', () => {
	it('targets the full length for three or more stories', () => {
		expect(wordRange(10, 3)).toEqual({ target: 1500, min: 1200, max: 1725 })
		expect(wordRange(10, 7)).toEqual(wordRange(10, 3))
	})

	it('lowers only the lower bound for one or two stories', () => {
		expect(wordRange(10, 1)).toEqual({ target: 750, min: 600, max: 1725 })
		expect(wordRange(10, 2)).toEqual(wordRange(10, 1))
	})

	it('makes a 90 second quiet day for zero stories at any length', () => {
		expect(wordRange(10, 0)).toEqual({ target: 225, min: 135, max: 338 })
		expect(wordRange(20, 0)).toEqual(wordRange(3, 0))
	})
})

describe('checkScript', () => {
	it('accepts a valid script', () => {
		const check = checkScript(script({}, [150, 150, 150, 150]), 5)
		expect(check.ok).toBe(true)
	})

	it('accepts every segment kind without requiring a challenge or wildcard', () => {
		const source = [{ title: 'Notes', url: 'https://example.com' }]
		const segments = (['stack', 'challenge', 'wildcard', 'update', 'watch'] as const).map(
			(kind) => ({
				heading: kind,
				kind,
				challenges: kind === 'challenge' ? 'Agents are overhyped' : null,
				topics: kind === 'stack' ? [] : ['AI models and agents'],
				packages: kind === 'stack' ? ['zod'] : [],
				sources: source,
			})
		)
		expect(checkScript(script({ segments }, [150, 150, 150, 150]), 5).ok).toBe(true)
		expect(checkScript(script({}, [150, 150, 150, 150]), 5).ok).toBe(true)
	})

	it('reports schema issues with their path', () => {
		const check = checkScript(
			script({ segments: [{ heading: 'H', kind: 'news', packages: [], sources: [] }] }),
			3
		)
		expect(check.ok).toBe(false)
		if (!check.ok) {
			expect(check.problems.some((problem) => problem.startsWith('segments.0.sources'))).toBe(true)
			expect(check.problems.some((problem) => problem.startsWith('segments.0.challenges'))).toBe(
				true
			)
			expect(check.problems.some((problem) => problem.startsWith('segments.0.topics'))).toBe(true)
		}
	})

	it('rejects a turn over 180 words', () => {
		const check = checkScript(script({}, [181, 100]), 3)
		expect(check).toEqual({ ok: false, problems: ['turns.0 has 181 words, the limit is 180'] })
	})

	it('rejects a total outside the range for the story count', () => {
		const short = checkScript(script({ storyCount: 3 }, [100, 100]), 3)
		expect(short.ok).toBe(false)
		if (!short.ok) expect(short.problems[0]).toContain('must be between 360 and 518')
		expect(checkScript(script({ storyCount: 1 }, [100, 100]), 3).ok).toBe(true)
	})

	it('replaces em and en dashes in turns with commas', () => {
		const raw = script()
		raw.turns[0] = { speaker: 'host', text: `${words(99)} a—b – c` }
		const check = checkScript(raw, 3)
		expect(check.ok).toBe(true)
		if (check.ok) expect(check.episode.turns[0]?.text.endsWith('a, b, c')).toBe(true)
	})
})

describe('removeDashes', () => {
	it('collapses whitespace around the replacement', () => {
		expect(removeDashes('one  —  two')).toBe('one, two')
	})
})
