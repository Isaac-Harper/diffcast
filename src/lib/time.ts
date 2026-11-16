const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isTimeZone(value: string): boolean {
	if (!value) return false
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value })
		return true
	} catch {
		return false
	}
}

export interface LocalTime {
	date: string
	hour: number
	minute: number
	weekday: number
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function localTime(instant: Date, timeZone: string): LocalTime {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short',
		hourCycle: 'h23',
	}).formatToParts(instant)
	const part = (type: Intl.DateTimeFormatPartTypes): string => {
		const value = parts.find((entry) => entry.type === type)?.value
		if (value === undefined) throw new Error(`Missing ${type} for ${timeZone}`)
		return value
	}
	const weekday = WEEKDAYS[part('weekday')]
	if (weekday === undefined) throw new Error(`Unknown weekday for ${timeZone}`)
	return {
		date: `${part('year')}-${part('month')}-${part('day')}`,
		hour: Number(part('hour')),
		minute: Number(part('minute')),
		weekday,
	}
}

function dayParts(date: string): [number, number, number] {
	const match = DAY.exec(date)
	if (!match) throw new Error(`Not a date: ${date}`)
	return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function offsetMinutes(instant: number, timeZone: string): number {
	const local = localTime(new Date(instant), timeZone)
	const [year, month, day] = dayParts(local.date)
	const asUtc = Date.UTC(year, month - 1, day, local.hour, local.minute)
	return Math.round((asUtc - Math.floor(instant / 60_000) * 60_000) / 60_000)
}

export function zonedInstant(date: string, hour: number, timeZone: string): Date {
	const [year, month, day] = dayParts(date)
	const guess = Date.UTC(year, month - 1, day, hour)
	const first = guess - offsetMinutes(guess, timeZone) * 60_000
	return new Date(guess - offsetMinutes(first, timeZone) * 60_000)
}

export function addDays(date: string, days: number): string {
	const [year, month, day] = dayParts(date)
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function weekdayOf(date: string): number {
	const [year, month, day] = dayParts(date)
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function isDay(value: string): boolean {
	const match = DAY.exec(value)
	if (!match) return false
	return addDays(value, 0) === value
}

export function calendarDaysFrom(start: string, count: number): string[] {
	return Array.from({ length: count }, (_, index) => addDays(start, index))
}

export const COMMON_TIME_ZONES = [
	'America/Los_Angeles',
	'America/Denver',
	'America/Phoenix',
	'America/Chicago',
	'America/New_York',
	'America/Toronto',
	'America/Sao_Paulo',
	'Europe/London',
	'Europe/Lisbon',
	'Europe/Berlin',
	'Europe/Paris',
	'Europe/Amsterdam',
	'Europe/Stockholm',
	'Europe/Warsaw',
	'Asia/Kolkata',
	'Asia/Singapore',
	'Asia/Tokyo',
	'Australia/Sydney',
	'Pacific/Auckland',
	'UTC',
]
