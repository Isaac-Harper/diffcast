import type { EpisodeFormat } from '@shared/contract'
import { weekdayOf } from './time'

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export const DAY_NAMES: Record<number, { short: string; long: string }> = {
	1: { short: 'Mon', long: 'Monday' },
	2: { short: 'Tue', long: 'Tuesday' },
	3: { short: 'Wed', long: 'Wednesday' },
	4: { short: 'Thu', long: 'Thursday' },
	5: { short: 'Fri', long: 'Friday' },
	6: { short: 'Sat', long: 'Saturday' },
	7: { short: 'Sun', long: 'Sunday' },
}

export function isoWeekday(sundayZero: number): number {
	return sundayZero === 0 ? 7 : sundayZero
}

export function isoWeekdayOf(date: string): number {
	return isoWeekday(weekdayOf(date))
}

export function formatForWeekday(weekday: number): EpisodeFormat {
	if (weekday === 6) return 'weekly_recap'
	if (weekday === 7) return 'week_ahead'
	return 'daily'
}

export function formatForDate(date: string): EpisodeFormat {
	return formatForWeekday(isoWeekdayOf(date))
}

export function normalizeDays(values: readonly unknown[]): number[] | null {
	const days = new Set<number>()
	for (const value of values) {
		const day = typeof value === 'string' && /^[1-7]$/.test(value) ? Number(value) : value
		if (typeof day !== 'number' || !(ISO_WEEKDAYS as readonly number[]).includes(day)) return null
		days.add(day)
	}
	if (days.size === 0) return null
	return [...days].sort((first, second) => first - second)
}

export function scheduleLabel(days: readonly number[]): string {
	const key = [...days].sort((first, second) => first - second).join('')
	if (key === '1234567') return 'Every day'
	if (key === '12345') return 'Weekdays'
	if (key === '67') return 'Weekends'
	return days.map((day) => DAY_NAMES[day]?.short ?? String(day)).join(', ')
}
