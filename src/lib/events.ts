export const EVENT_KINDS = [
	'landing_view',
	'sample_play',
	'signup_start',
	'checkout_start',
	'paid',
	'cancel',
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export const BROWSER_EVENT_KINDS = ['landing_view', 'sample_play'] as const

export type BrowserEventKind = (typeof BROWSER_EVENT_KINDS)[number]

export const EVENTS_PATH = '/api/events'

export function parseBrowserEvent(body: unknown): BrowserEventKind | null {
	if (typeof body !== 'object' || body === null || !('kind' in body)) return null
	const kind = body.kind
	return (BROWSER_EVENT_KINDS as readonly unknown[]).includes(kind)
		? (kind as BrowserEventKind)
		: null
}

const ANALYTICS_PATHS = new Set(['/', '/start', '/agents', '/privacy', '/terms', '/signin'])

export function publicAnalyticsUrl(url: string): string | null {
	const parsed = new URL(url)
	if (!ANALYTICS_PATHS.has(parsed.pathname)) return null
	return `${parsed.origin}${parsed.pathname}`
}
