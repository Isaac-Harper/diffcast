import { lookup as dnsLookup } from 'node:dns'
import type { LookupAddress } from 'node:dns'
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { LookupFunction } from 'node:net'

export const MAX_DOCUMENT_BYTES = 10 * 1024
export const FETCH_DEADLINE_MS = 5000

const blocked = new BlockList()
for (const [network, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4],
] as const) {
	blocked.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
	['::', 128],
	['::1', 128],
	['64:ff9b::', 96],
	['100::', 64],
	['2001::', 23],
	['2001:db8::', 32],
	['2002::', 16],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8],
] as const) {
	blocked.addSubnet(network, prefix, 'ipv6')
}

const globalUnicast = new BlockList()
globalUnicast.addSubnet('2000::', 3, 'ipv6')

// BlockList also matches IPv4 lookups against IPv6 rules, so ::ffff:0:0/96 cannot be a rule.
const MAPPED_IPV4 = /^::ffff:(?:0:)?(\d{1,3}(?:\.\d{1,3}){3})$/i

export function isPublicAddress(address: string): boolean {
	const family = isIP(address)
	if (family === 0) return false
	if (family === 4) return !blocked.check(address, 'ipv4')
	const mapped = MAPPED_IPV4.exec(address)?.[1]
	if (mapped !== undefined) return isPublicAddress(mapped)
	if (/^::ffff:/i.test(address)) return false
	return !blocked.check(address, 'ipv6') && globalUnicast.check(address, 'ipv6')
}

export class MetadataFetchError extends Error {}

export const guardedLookup: LookupFunction = (hostname, options, callback) => {
	dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
		if (error) {
			callback(error, '', 0)
			return
		}
		const list = addresses as LookupAddress[]
		const unsafe = list.find((entry) => !isPublicAddress(entry.address))
		if (list.length === 0 || unsafe) {
			callback(new MetadataFetchError(`${hostname} does not resolve to a public address`), '', 0)
			return
		}
		if (options.all) {
			callback(null, list)
			return
		}
		const first = list[0] as LookupAddress
		callback(null, first.address, first.family)
	})
}

export interface FetchedDocument {
	body: unknown
	cacheControl: string | null
}

export interface Transport {
	request: (
		url: URL,
		options: RequestOptions,
		onResponse: (response: IncomingMessage) => void
	) => ClientRequest
	lookup: LookupFunction
	deadlineMs: number
}

const HTTPS: Transport = {
	request: httpsRequest,
	lookup: guardedLookup,
	deadlineMs: FETCH_DEADLINE_MS,
}

export function readDocument(url: URL, transport: Transport): Promise<FetchedDocument> {
	return new Promise((resolve, reject) => {
		let settled = false
		const finish = (outcome: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(deadline)
			outcome()
		}
		const fail = (error: unknown) =>
			finish(() =>
				reject(
					error instanceof MetadataFetchError
						? error
						: new MetadataFetchError(error instanceof Error ? error.message : String(error))
				)
			)
		const outgoing = transport.request(
			url,
			{ method: 'GET', lookup: transport.lookup, headers: { accept: 'application/json' } },
			(response) => {
				if (response.statusCode !== 200) {
					response.resume()
					outgoing.destroy()
					fail(new MetadataFetchError(`Metadata document answered ${response.statusCode}`))
					return
				}
				const chunks: Buffer[] = []
				let size = 0
				response.on('data', (chunk: Buffer) => {
					size += chunk.length
					if (size > MAX_DOCUMENT_BYTES) {
						outgoing.destroy()
						fail(new MetadataFetchError('Metadata document is too large'))
						return
					}
					chunks.push(chunk)
				})
				response.on('end', () => {
					let body: unknown
					try {
						body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
					} catch {
						fail(new MetadataFetchError('Metadata document is not JSON'))
						return
					}
					const header = response.headers['cache-control']
					finish(() => resolve({ body, cacheControl: typeof header === 'string' ? header : null }))
				})
				response.on('error', fail)
			}
		)
		const deadline = setTimeout(() => {
			outgoing.destroy()
			fail(new MetadataFetchError(`Metadata fetch passed its ${transport.deadlineMs} ms deadline`))
		}, transport.deadlineMs)
		outgoing.on('error', fail)
		outgoing.end()
	})
}

export function fetchMetadataDocument(clientId: string): Promise<FetchedDocument> {
	const url = new URL(clientId)
	if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')) {
		return Promise.reject(new MetadataFetchError('Client id urls must be https on port 443'))
	}
	if (isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0) {
		return Promise.reject(new MetadataFetchError('Client id urls must use a host name'))
	}
	return readDocument(url, HTTPS)
}
