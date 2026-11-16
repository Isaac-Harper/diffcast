export function blobStoreId(token: string | undefined): string | null {
	const id = token?.split('_')[3]
	return id && /^[A-Za-z0-9]+$/.test(id) ? id.toLowerCase() : null
}

export function audioPathname(listenerId: number, date: string): string {
	return `episodes/${listenerId}/${date}.mp3`
}

export function isBlobUrl(value: string, storeId: string | null, listenerId: number): boolean {
	if (!storeId) return false
	try {
		const url = new URL(value)
		return (
			url.protocol === 'https:' &&
			url.port === '' &&
			url.username === '' &&
			url.password === '' &&
			url.hostname === `${storeId}.private.blob.vercel-storage.com` &&
			url.pathname.startsWith(`/episodes/${listenerId}/`) &&
			url.pathname.endsWith('.mp3') &&
			!value.includes('%') &&
			!value.includes('?') &&
			url.search === '' &&
			url.hash === ''
		)
	} catch {
		return false
	}
}
