import type { Listened, Verdict, WouldPay } from './episode-types'
import { formatForDate, isoWeekdayOf } from './schedule'
import { calendarDaysFrom, isDay, zonedInstant } from './time'

export const DEFAULT_GATE_DAYS = 14
export const STORY_THRESHOLD = 3
export const LISTEN_SHARE = 0.6
export const STORY_SHARE = 0.8
export const LISTENERS_NEEDED = 5
export const PAYERS_NEEDED = 3
export const ERRORS_PER_SEGMENTS = 20
export const ON_TIME_HOUR = 6
export const SMOKE_MODEL = 'smoke'

export interface GateWindow {
	start: string
	days: number
	dates: string[]
}

export function gateWindow(
	env: Record<string, string | undefined> = process.env
): GateWindow | null {
	const start = env['DIFFCAST_GATE_START']
	if (!start || !isDay(start)) return null
	const rawDays = env['DIFFCAST_GATE_DAYS']
	const days = rawDays ? Number(rawDays) : DEFAULT_GATE_DAYS
	if (!Number.isInteger(days) || days < 1 || days > 60) {
		throw new Error(`DIFFCAST_GATE_DAYS must be a whole number from 1 to 60, got ${rawDays}`)
	}
	return { start, days, dates: calendarDaysFrom(start, days) }
}

export interface GateEpisode {
	model: string
	publishedOn: string
	storyCount: number
	createdAtMs: number
	costUsd: number
	downloaded: boolean
	listened: Listened | null
}

export interface GateListener {
	id: number
	name: string
	timezone: string
	days: number[]
	wouldPay: WouldPay | null
	episodes: GateEpisode[]
}

export interface ListenerGate {
	id: number
	name: string
	days: number[]
	scheduled: number
	expected: number
	delivered: number
	downloaded: number
	listened: number
	listenNeeded: number
	storyDays: number
	storyNeeded: number
	wouldPay: WouldPay | null
	meetsListen: boolean
	meetsStories: boolean
}

export function listenTarget(days: number): number {
	return Math.ceil(days * LISTEN_SHARE)
}

export function storyTarget(days: number): number {
	return Math.ceil(days * STORY_SHARE)
}

export function windowEpisodes(episodes: GateEpisode[], window: GateWindow): GateEpisode[] {
	const dates = new Set(window.dates)
	return episodes.filter(
		(episode) => episode.model !== SMOKE_MODEL && dates.has(episode.publishedOn)
	)
}

export function scheduledDates(window: GateWindow, days: readonly number[]): string[] {
	return window.dates.filter((date) => days.includes(isoWeekdayOf(date)))
}

export function expectedEpisodes(
	window: GateWindow,
	days: readonly number[],
	today: string
): number {
	return scheduledDates(window, days).filter((date) => date <= today).length
}

export function isDaily(date: string): boolean {
	return formatForDate(date) === 'daily'
}

export function isOnTime(episode: GateEpisode, timeZone: string): boolean {
	return episode.createdAtMs < zonedInstant(episode.publishedOn, ON_TIME_HOUR, timeZone).getTime()
}

export function listenerGate(
	listener: GateListener,
	window: GateWindow,
	today: string
): ListenerGate {
	const scheduled = scheduledDates(window, listener.days)
	const delivered = windowEpisodes(listener.episodes, window)
	const listened = delivered.filter(
		(episode) => episode.listened === 'yes' || episode.listened === 'partly'
	).length
	const storyDays = delivered.filter(
		(episode) => isDaily(episode.publishedOn) && episode.storyCount >= STORY_THRESHOLD
	).length
	const listenNeeded = listenTarget(scheduled.length)
	const storyNeeded = storyTarget(scheduled.filter(isDaily).length)
	return {
		id: listener.id,
		name: listener.name,
		days: listener.days,
		scheduled: scheduled.length,
		expected: expectedEpisodes(window, listener.days, today),
		delivered: delivered.length,
		downloaded: delivered.filter((episode) => episode.downloaded).length,
		listened,
		listenNeeded,
		storyDays,
		storyNeeded,
		wouldPay: listener.wouldPay,
		meetsListen: listened >= listenNeeded,
		meetsStories: storyDays >= storyNeeded,
	}
}

export interface CheckCounts {
	checked: number
	errors: number
}

export interface GateCheck {
	verdict: Verdict
	model: string
}

export function countChecks(checks: GateCheck[]): CheckCounts {
	const counted = checks.filter((check) => check.model !== SMOKE_MODEL)
	return {
		checked: counted.length,
		errors: counted.filter((check) => check.verdict === 'error').length,
	}
}

export function meetsErrorLine(counts: CheckCounts): boolean {
	return counts.checked > 0 && counts.errors * ERRORS_PER_SEGMENTS <= counts.checked
}

export interface CostSummary {
	average: number | null
	max: number | null
}

export function costSummary(costs: number[]): CostSummary {
	if (costs.length === 0) return { average: null, max: null }
	return {
		average: costs.reduce((sum, cost) => sum + cost, 0) / costs.length,
		max: Math.max(...costs),
	}
}

export function onTimeRate(listeners: GateListener[], window: GateWindow): number | null {
	const delivered = listeners.flatMap((listener) =>
		windowEpisodes(listener.episodes, window).map((episode) => isOnTime(episode, listener.timezone))
	)
	if (delivered.length === 0) return null
	return delivered.filter(Boolean).length / delivered.length
}

export interface GateReport {
	window: GateWindow
	listeners: ListenerGate[]
	listen: { count: number; needed: number; met: boolean }
	pay: { count: number; needed: number; met: boolean }
	stories: { count: number; of: number; met: boolean }
	errors: CheckCounts & { met: boolean }
	cost: CostSummary
	onTime: number | null
}

export function gateReport(
	listeners: GateListener[],
	checks: GateCheck[],
	window: GateWindow,
	today: string
): GateReport {
	const rows = listeners.map((listener) => listenerGate(listener, window, today))
	const listenCount = rows.filter((row) => row.meetsListen).length
	const payCount = rows.filter((row) => row.wouldPay === 'yes').length
	const storyCount = rows.filter((row) => row.meetsStories).length
	const counts = countChecks(checks)
	const costs = listeners.flatMap((listener) =>
		windowEpisodes(listener.episodes, window).map((episode) => episode.costUsd)
	)
	return {
		window,
		listeners: rows,
		listen: {
			count: listenCount,
			needed: LISTENERS_NEEDED,
			met: listenCount >= LISTENERS_NEEDED,
		},
		pay: { count: payCount, needed: PAYERS_NEEDED, met: payCount >= PAYERS_NEEDED },
		stories: {
			count: storyCount,
			of: rows.length,
			met: rows.length > 0 && storyCount === rows.length,
		},
		errors: { ...counts, met: meetsErrorLine(counts) },
		cost: costSummary(costs),
		onTime: onTimeRate(listeners, window),
	}
}
