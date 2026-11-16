import { describe, expect, it } from 'vitest'
import type { DueListener } from '../../../shared/contract.ts'
import { buildBrief, weekdayName, windowStart } from './brief.ts'

describe('windowStart', () => {
	it('starts at the last episode, or yesterday for a first episode', () => {
		expect(windowStart({ date: '2026-11-18', since: '2026-11-17' })).toBe('2026-11-17')
		expect(windowStart({ date: '2026-11-18', since: null })).toBe('2026-11-17')
		expect(windowStart({ date: '2026-11-16', since: '2026-11-13' })).toBe('2026-11-13')
	})

	it('reaches back at most 8 days and crosses month and year boundaries', () => {
		expect(windowStart({ date: '2026-11-20', since: '2026-10-01' })).toBe('2026-11-12')
		expect(windowStart({ date: '2026-11-20', since: '2026-11-12' })).toBe('2026-11-12')
		expect(windowStart({ date: '2027-01-01', since: null })).toBe('2026-12-31')
		expect(windowStart({ date: '2026-03-02', since: '2026-02-27' })).toBe('2026-02-27')
	})
})

const base: DueListener = {
	listenerId: 4,
	date: '2026-11-16',
	format: 'daily',
	since: '2026-11-13',
	timezone: 'Europe/Berlin',
	minutes: 10,
	stack: [{ name: 'react', ecosystem: 'npm' }],
	focus: '',
	interests: [
		{ topic: 'AI models and agents', take: 'Agents are overhyped', note: null },
		{ topic: 'Open source', take: null, note: 'Licensing' },
	],
	recent: [],
	feedback: [],
}

describe('buildBrief', () => {
	it('carries the date window, length targets and listener data only', () => {
		const brief = buildBrief({
			...base,
			focus: 'Uses ``` fences',
		})
		expect(weekdayName('2026-11-16')).toBe('Monday')
		expect(brief).toContain('Today is Monday 2026-11-16')
		expect(brief).toContain('Format: daily news.')
		expect(brief).toContain(
			'The last episode was on 2026-11-13: cover everything since the morning of 2026-11-13.'
		)
		expect(brief).toContain('never say "since the last episode"')
		expect(brief).toContain('about 1500 words (1200 to 1725)')
		expect(brief).toContain('````json')
		expect(brief).not.toContain('listenerId')
		expect(brief).toContain('Interests (2): AI models and agents; Open source.')
		expect(brief).toContain('Interests with a take: AI models and agents.')
		expect(brief).toContain('"take": "Agents are overhyped"')
	})

	it('covers 24 hours midweek and allows "since the last episode" only after one', () => {
		const brief = buildBrief({
			...base,
			date: '2026-11-18',
			since: '2026-11-17',
			interests: [{ topic: 'Open source', take: null, note: null }],
			recent: [{ date: '2026-11-17', title: 'Tuesday', segments: [] }],
		})
		expect(brief).toContain('Cover the last 24 hours, since the morning of 2026-11-17.')
		expect(brief).toContain('The previous episode was on 2026-11-17')
		expect(brief).toContain('No interest has a take')
	})

	it('caps a long gap at 8 days', () => {
		const brief = buildBrief({ ...base, date: '2026-11-20', since: '2026-10-30' })
		expect(brief).toContain('Cover everything since the morning of 2026-11-12, the last 8 days.')
	})

	it('writes Saturday as the week in review, at the full length', () => {
		const brief = buildBrief({
			...base,
			date: '2026-11-21',
			format: 'weekly_recap',
			since: '2026-11-20',
			recent: [{ date: '2026-11-20', title: 'Friday', segments: [] }],
		})
		expect(brief).toContain('Format: weekly_recap')
		expect(brief).toContain('Recap the week from Monday 2026-11-16 to today')
		expect(brief).toContain('Lean on the stories in `recent`')
		expect(brief).toContain('Cover the last 24 hours, since the morning of 2026-11-20.')
		expect(brief).toContain('about 1500 words (1200 to 1725)')
	})

	it('writes Sunday as a short look at the week ahead', () => {
		const brief = buildBrief({
			...base,
			date: '2026-11-22',
			format: 'week_ahead',
			since: '2026-11-20',
		})
		expect(brief).toContain('Format: week_ahead')
		expect(brief).toContain('2026-11-23 to 2026-11-29')
		expect(brief).toContain('New research covers since the morning of 2026-11-20.')
		expect(brief).toContain('the short week ahead, about 4 minutes')
		expect(brief).toContain('about 600 words (480 to 690)')
	})
})
