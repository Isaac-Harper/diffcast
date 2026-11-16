import type { EpisodeFormat } from '@shared/contract'
import { formatForWeekday, isoWeekday } from './schedule'
import { localTime } from './time'

export const DUE_START_HOUR = 3
export const DUE_END_HOUR = 6

export interface DueDay {
	date: string
	format: EpisodeFormat
}

export function dueDay(now: Date, timeZone: string, days: readonly number[]): DueDay | null {
	const local = localTime(now, timeZone)
	if (local.hour < DUE_START_HOUR || local.hour >= DUE_END_HOUR) return null
	const weekday = isoWeekday(local.weekday)
	if (!days.includes(weekday)) return null
	return { date: local.date, format: formatForWeekday(weekday) }
}

export function selectDue<T extends { id: number; timezone: string; days: readonly number[] }>(
	listeners: T[],
	now: Date,
	hasEpisode: (listenerId: number, date: string) => boolean
): ({ listener: T } & DueDay)[] {
	return listeners.flatMap((listener) => {
		const day = dueDay(now, listener.timezone, listener.days)
		if (day === null || hasEpisode(listener.id, day.date)) return []
		return [{ listener, ...day }]
	})
}
