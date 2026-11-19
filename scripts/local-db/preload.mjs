const port = Number(process.env.LOCAL_DB_PORT ?? 4444)
const original = globalThis.fetch
globalThis.fetch = (input, init) => {
	const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
	if (url.hostname.endsWith('.localtest.me') && url.pathname === '/sql') {
		return original(`http://127.0.0.1:${port}/sql`, init)
	}
	return original(input, init)
}
