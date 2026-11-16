import { localTime } from './time'

export const DUE_START_HOUR = 3
export const DUE_END_HOUR = 6

export function dueDate(now: Date, timeZone: string): string | null {
	const local = localTime(now, timeZone)
	if (local.weekday < 1 || local.weekday > 5) return null
	if (local.hour < DUE_START_HOUR || local.hour >= DUE_END_HOUR) return null
	return local.date
}

export function selectDue<T extends { id: number; timezone: string }>(
	listeners: T[],
	now: Date,
	hasEpisode: (listenerId: number, date: string) => boolean
): { listener: T; date: string }[] {
	return listeners.flatMap((listener) => {
		const date = dueDate(now, listener.timezone)
		if (date === null || hasEpisode(listener.id, date)) return []
		return [{ listener, date }]
	})
}
