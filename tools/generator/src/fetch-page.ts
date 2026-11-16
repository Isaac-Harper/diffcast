import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

export const PAGE_TEXT_LIMIT = 6000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20 * 1000
const MAX_REDIRECTS = 5

export type FetchedPage = { url: string; title: string; text: string; truncated: boolean }

export type HostResolver = (hostname: string) => Promise<string[]>

const resolveHost: HostResolver = async (hostname) =>
	(await lookup(hostname, { all: true })).map((entry) => entry.address)

function isPrivateIpv4(address: string): boolean {
	const [a = 0, b = 0] = address.split('.').map(Number)
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		a >= 224
	)
}

export function isPrivateAddress(address: string): boolean {
	if (isIP(address) === 4) return isPrivateIpv4(address)
	const lower = address.toLowerCase()
	const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
	if (mapped?.[1]) return isPrivateIpv4(mapped[1])
	return (
		lower === '::' ||
		lower === '::1' ||
		/^f[cd]/.test(lower) ||
		/^fe[89ab]/.test(lower) ||
		lower.startsWith('ff')
	)
}

export async function checkPublicUrl(
	raw: string,
	resolve: HostResolver = resolveHost
): Promise<URL> {
	let url: URL
	try {
		url = new URL(raw)
	} catch {
		throw new Error(`not a valid url: ${raw}`)
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`only http and https urls can be fetched, not ${url.protocol}`)
	}
	if (url.username || url.password) throw new Error('urls with credentials are not fetched')
	const hostname = url.hostname.replace(/^\[|\]$/g, '')
	if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
		throw new Error(`refusing a private host: ${hostname}`)
	}
	const addresses = isIP(hostname) ? [hostname] : await resolve(hostname)
	if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
		throw new Error(`refusing a private host: ${hostname}`)
	}
	return url
}

async function readCapped(response: Response): Promise<string> {
	if (!response.body) return ''
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let total = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		total += value.byteLength
		if (total > MAX_RESPONSE_BYTES) {
			await reader.cancel()
			break
		}
		chunks.push(value)
	}
	return new TextDecoder().decode(Buffer.concat(chunks))
}

export function readableText(html: string, url: string): { title: string; text: string } {
	const { document } = parseHTML(html)
	const title = document.querySelector('title')?.textContent?.trim() ?? ''
	const article = new Readability(
		document as unknown as ConstructorParameters<typeof Readability>[0]
	).parse()
	const text = article?.textContent ?? document.body?.textContent ?? ''
	return {
		title: article?.title?.trim() || title || url,
		text: text
			.replace(/[ \t ]+/g, ' ')
			.replace(/\s*\n\s*/g, '\n')
			.trim(),
	}
}

export function truncateText(
	text: string,
	limit: number = PAGE_TEXT_LIMIT
): { text: string; truncated: boolean } {
	if (text.length <= limit) return { text, truncated: false }
	return { text: text.slice(0, limit), truncated: true }
}

export async function fetchPage(
	raw: string,
	resolve: HostResolver = resolveHost
): Promise<FetchedPage> {
	let url = await checkPublicUrl(raw, resolve)
	const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
	for (let redirects = 0; ; redirects++) {
		const response = await fetch(url, {
			redirect: 'manual',
			signal,
			headers: {
				'user-agent': 'Mozilla/5.0 (compatible; diffcast-research/1.0)',
				accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
			},
		})
		const location = response.headers.get('location')
		if (response.status >= 300 && response.status < 400 && location) {
			if (redirects >= MAX_REDIRECTS) throw new Error(`too many redirects from ${raw}`)
			url = await checkPublicUrl(new URL(location, url).toString(), resolve)
			continue
		}
		if (!response.ok) throw new Error(`${url} answered ${response.status}`)
		const type = response.headers.get('content-type') ?? ''
		if (!/text\/|html|xml|json/.test(type))
			throw new Error(`${url} is ${type || 'of unknown type'}, not text`)
		const body = await readCapped(response)
		const page = /html|xml/.test(type)
			? readableText(body, url.toString())
			: { title: url.toString(), text: body.trim() }
		if (!page.text) throw new Error(`${url} has no readable text`)
		return { url: url.toString(), title: page.title, ...truncateText(page.text) }
	}
}
