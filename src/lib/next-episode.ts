import type { EpisodeFormat } from '@shared/contract'
import { DUE_END_HOUR } from './due'
import { formatForWeekday, isoWeekdayOf } from './schedule'
import { addDays, localTime, zonedInstant } from './time'

export const LAST_GENERATOR_HOUR = DUE_END_HOUR - 1

export interface NextEpisode {
	date: string
	format: EpisodeFormat
	readyBy: Date
}

export function nextEpisode(
	now: Date,
	timeZone: string,
	days: readonly number[],
	latestEpisodeDate: string | null
): NextEpisode {
	const local = localTime(now, timeZone)
	const todayStillOpen = local.hour < LAST_GENERATOR_HOUR && latestEpisodeDate !== local.date
	for (let offset = todayStillOpen ? 0 : 1; offset <= 7; offset += 1) {
		const date = addDays(local.date, offset)
		const weekday = isoWeekdayOf(date)
		if (days.includes(weekday)) {
			return {
				date,
				format: formatForWeekday(weekday),
				readyBy: zonedInstant(date, DUE_END_HOUR, timeZone),
			}
		}
	}
	throw new Error(`No episode day in ${JSON.stringify(days)}`)
}

const FORMAT_NAMES: Record<EpisodeFormat, string> = {
	daily: 'daily news',
	weekly_recap: 'week in review',
	week_ahead: 'week ahead',
}

function relativeDay(now: Date, date: string, timeZone: string): string | null {
	const today = localTime(now, timeZone).date
	if (date === today) return 'Today'
	if (date === addDays(today, 1)) return 'Tomorrow'
	return null
}

export function describeNextEpisode(now: Date, next: NextEpisode, timeZone: string): string {
	const day = next.readyBy.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone,
	})
	const time = next.readyBy.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone,
		timeZoneName: 'short',
	})
	const relative = relativeDay(now, next.date, timeZone)
	const when = relative ? `${relative}, ${day}` : day
	return `${when}, by ${time} (${FORMAT_NAMES[next.format]})`
}
