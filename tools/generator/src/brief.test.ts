import { describe, expect, it } from 'vitest'
import type { DueListener } from '../../../shared/contract.ts'
import { buildBrief, previousWeekday, weekdayName } from './brief.ts'

describe('previousWeekday', () => {
	it('steps back one day midweek', () => {
		expect(previousWeekday('2026-11-18')).toBe('2026-11-17')
	})

	it('covers the weekend on Monday', () => {
		expect(previousWeekday('2026-11-16')).toBe('2026-11-13')
	})

	it('crosses month and year boundaries', () => {
		expect(previousWeekday('2027-01-01')).toBe('2026-12-31')
		expect(previousWeekday('2026-03-02')).toBe('2026-02-27')
	})
})

const base: DueListener = {
	listenerId: 4,
	date: '2026-11-16',
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
		expect(brief).toContain('cover the weekend, everything since the morning of 2026-11-13')
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
			interests: [{ topic: 'Open source', take: null, note: null }],
			recent: [{ date: '2026-11-17', title: 'Tuesday', segments: [] }],
		})
		expect(brief).toContain('Cover the last 24 hours.')
		expect(brief).toContain('The previous episode was on 2026-11-17')
		expect(brief).toContain('No interest has a take')
	})
})
