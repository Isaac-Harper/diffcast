export function formatDate(date: string): string {
	return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC',
	})
}

export function formatMinutes(seconds: number): string {
	return `${Math.max(1, Math.round(seconds / 60))} min`
}

export function formatUsd(value: number | null): string {
	if (value === null) return 'n/a'
	return `$${value.toFixed(value < 1 ? 3 : 2)}`
}

export function formatPercent(value: number | null): string {
	if (value === null) return 'n/a'
	return `${Math.round(value * 100)}%`
}

export function formatInstant(value: string | null): string {
	if (!value) return 'never'
	return new Date(value).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC',
		timeZoneName: 'short',
	})
}
