const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export const MAX_REDIRECT_URIS = 10
export const MAX_REDIRECT_URI_LENGTH = 2000

export function isLoopbackRedirect(uri: string): boolean {
	try {
		return LOOPBACK_HOSTS.has(new URL(uri).hostname)
	} catch {
		return false
	}
}

export function isAllowedRedirectUri(uri: string): boolean {
	if (uri.length > MAX_REDIRECT_URI_LENGTH) return false
	let url: URL
	try {
		url = new URL(uri)
	} catch {
		return false
	}
	if (url.hash || url.username || url.password) return false
	if (url.protocol === 'https:') return true
	return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
}

export function redirectHost(uri: string): string {
	return new URL(uri).host
}

export function withQuery(uri: string, params: Record<string, string | null>): string {
	const url = new URL(uri)
	for (const [key, value] of Object.entries(params)) {
		if (value !== null) url.searchParams.set(key, value)
	}
	return url.toString()
}
