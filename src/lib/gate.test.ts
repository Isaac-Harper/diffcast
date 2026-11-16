import { describe, expect, it } from 'vitest'
import {
	costSummary,
	countChecks,
	expectedEpisodes,
	gateReport,
	gateWindow,
	isOnTime,
	listenerGate,
	listenTarget,
	meetsErrorLine,
	onTimeRate,
	SMOKE_MODEL,
	storyTarget,
} from './gate'
import type { GateCheck, GateEpisode, GateListener } from './gate'

const WINDOW = gateWindow({ DIFFCAST_GATE_START: '2026-11-16' })
if (!WINDOW) throw new Error('window')

function episode(date: string, overrides: Partial<GateEpisode> = {}): GateEpisode {
	return {
		model: 'claude-sonnet-5-5',
		publishedOn: date,
		storyCount: 4,
		createdAtMs: Date.parse(`${date}T12:00:00Z`),
		costUsd: 0.3,
		downloaded: true,
		listened: 'yes',
		...overrides,
	}
}

function listener(id: number, overrides: Partial<GateListener> = {}): GateListener {
	return {
		id,
		name: `L${id}`,
		timezone: 'America/Los_Angeles',
		wouldPay: null,
		episodes: [],
		...overrides,
	}
}

describe('gate window', () => {
	it('takes weekdays from the start, default 10', () => {
		expect(WINDOW.dates).toHaveLength(10)
		expect(WINDOW.dates[0]).toBe('2026-11-16')
		expect(WINDOW.dates[5]).toBe('2026-11-23')
		expect(WINDOW.dates.at(-1)).toBe('2026-11-27')
		expect(gateWindow({})).toBeNull()
		expect(gateWindow({ DIFFCAST_GATE_START: '2026-11-16', DIFFCAST_GATE_DAYS: '5' })?.days).toBe(5)
		expect(() =>
			gateWindow({ DIFFCAST_GATE_START: '2026-11-16', DIFFCAST_GATE_DAYS: 'x' })
		).toThrow()
	})

	it('scales the targets with the window', () => {
		expect(listenTarget(10)).toBe(6)
		expect(storyTarget(10)).toBe(8)
		expect(expectedEpisodes(WINDOW, '2026-11-18')).toBe(3)
		expect(expectedEpisodes(WINDOW, '2026-12-31')).toBe(10)
	})
})

describe('listener metrics', () => {
	it('counts delivered, downloaded, listened and story days inside the window only', () => {
		const row = listenerGate(
			listener(1, {
				wouldPay: 'maybe',
				episodes: [
					...WINDOW.dates.slice(0, 6).map((date) => episode(date)),
					episode(WINDOW.dates[6] ?? '', { listened: 'partly', storyCount: 2 }),
					episode(WINDOW.dates[7] ?? '', { listened: 'no', downloaded: false }),
					episode(WINDOW.dates[8] ?? '', { listened: null, storyCount: 0 }),
					episode('2026-11-13'),
				],
			}),
			WINDOW,
			'2026-12-01'
		)
		expect(row).toMatchObject({
			expected: 10,
			delivered: 9,
			downloaded: 8,
			listened: 7,
			storyDays: 7,
			wouldPay: 'maybe',
			meetsListen: true,
			meetsStories: false,
		})
	})

	it('is on time only before 06:00 local', () => {
		expect(
			isOnTime(
				episode('2026-11-16', { createdAtMs: Date.parse('2026-11-16T13:59:00Z') }),
				'America/Los_Angeles'
			)
		).toBe(true)
		expect(
			isOnTime(
				episode('2026-11-16', { createdAtMs: Date.parse('2026-11-16T14:00:00Z') }),
				'America/Los_Angeles'
			)
		).toBe(false)
	})
})

describe('gate lines', () => {
	it('needs at least one check and at most 1 error per 20', () => {
		expect(meetsErrorLine({ checked: 0, errors: 0 })).toBe(false)
		expect(meetsErrorLine({ checked: 20, errors: 1 })).toBe(true)
		expect(meetsErrorLine({ checked: 19, errors: 1 })).toBe(false)
		expect(meetsErrorLine({ checked: 40, errors: 2 })).toBe(true)
	})

	it('summarises cost and on time rate', () => {
		expect(costSummary([])).toEqual({ average: null, max: null })
		expect(costSummary([0.2, 0.4])).toEqual({ average: 0.30000000000000004, max: 0.4 })
		const late = episode('2026-11-17', { createdAtMs: Date.parse('2026-11-17T15:00:00Z') })
		expect(onTimeRate([listener(1, { episodes: [episode('2026-11-16'), late] })], WINDOW)).toBe(0.5)
		expect(onTimeRate([listener(1)], WINDOW)).toBeNull()
	})

	it('reports each Phase 0 line', () => {
		const full = WINDOW.dates.map((date) => episode(date))
		const listeners = [
			...[1, 2, 3, 4, 5].map((id) =>
				listener(id, { episodes: full, wouldPay: id <= 3 ? 'yes' : 'no' })
			),
			listener(6, { episodes: full.slice(0, 5) }),
		]
		const checks: GateCheck[] = [
			...Array.from({ length: 19 }, () => ({ verdict: 'correct' as const, model: 'm' })),
			{ verdict: 'error', model: 'm' },
		]
		const report = gateReport(listeners, checks, WINDOW, '2026-12-01')
		expect(report.listen).toEqual({ count: 5, needed: 5, episodes: 6, met: true })
		expect(report.pay).toEqual({ count: 3, needed: 3, met: true })
		expect(report.stories).toEqual({ count: 5, of: 6, days: 8, met: false })
		expect(report.errors).toEqual({ checked: 20, errors: 1, met: true })
		expect(report.cost.max).toBe(0.3)
		expect(report.onTime).toBe(1)
	})

	it('ignores smoke episodes and their checks in every metric', () => {
		const smoke = (date: string) =>
			episode(date, {
				model: SMOKE_MODEL,
				costUsd: 9,
				createdAtMs: Date.parse(`${date}T20:00:00Z`),
			})
		const listeners = [
			listener(1, {
				episodes: [
					...WINDOW.dates.slice(0, 2).map((date) => episode(date)),
					...WINDOW.dates.slice(2).map(smoke),
				],
			}),
			listener(2, { episodes: WINDOW.dates.map(smoke) }),
		]
		const checks: GateCheck[] = [
			{ verdict: 'correct', model: 'm' },
			{ verdict: 'error', model: SMOKE_MODEL },
			{ verdict: 'error', model: SMOKE_MODEL },
		]
		const report = gateReport(listeners, checks, WINDOW, '2026-12-01')
		expect(
			report.listeners.map((row) => [row.delivered, row.downloaded, row.listened, row.storyDays])
		).toEqual([
			[2, 2, 2, 2],
			[0, 0, 0, 0],
		])
		expect(report.listen.count).toBe(0)
		expect(report.stories.count).toBe(0)
		expect(report.errors).toEqual({ checked: 1, errors: 0, met: true })
		expect(report.cost).toEqual({ average: 0.3, max: 0.3 })
		expect(report.onTime).toBe(1)
		expect(countChecks(checks)).toEqual({ checked: 1, errors: 0 })
	})
})
