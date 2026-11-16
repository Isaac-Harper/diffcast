export const RETURN_COOKIE = 'diffcast_return'
export const RETURN_COOKIE_SECONDS = 15 * 60

const ALLOWED_PATHS = new Set(['/account', '/oauth/authorize'])
const PROBE_ORIGIN = 'https://return.invalid'

export function safeReturnPath(value: unknown): string | null {
	if (typeof value !== 'string' || value.length > 4000 || !value.startsWith('/')) return null
	if (value.startsWith('//') || value.includes('\\')) return null
	let url: URL
	try {
		url = new URL(value, PROBE_ORIGIN)
	} catch {
		return null
	}
	if (url.origin !== PROBE_ORIGIN || !ALLOWED_PATHS.has(url.pathname) || url.hash) return null
	if (url.pathname === '/account' && url.search) return null
	return `${url.pathname}${url.search}`
}

export function searchParamsFrom(
	record: Record<string, string | string[] | undefined>
): URLSearchParams {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(record)) {
		if (value === undefined) continue
		for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry)
	}
	return params
}
