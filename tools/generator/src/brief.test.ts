import { describe, expect, it } from 'vitest'
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

describe('buildBrief', () => {
	it('carries the date window, length targets and listener data only', () => {
		const brief = buildBrief({
			listenerId: 4,
			date: '2026-11-16',
			timezone: 'Europe/Berlin',
			minutes: 10,
			stack: [{ name: 'react', ecosystem: 'npm' }],
			focus: 'Uses ``` fences',
			recent: [],
			feedback: [],
		})
		expect(weekdayName('2026-11-16')).toBe('Monday')
		expect(brief).toContain('Today is Monday 2026-11-16')
		expect(brief).toContain("since the previous weekday's episode on 2026-11-13")
		expect(brief).toContain('about 1500 words (1200 to 1725)')
		expect(brief).toContain('````json')
		expect(brief).not.toContain('listenerId')
	})
})
