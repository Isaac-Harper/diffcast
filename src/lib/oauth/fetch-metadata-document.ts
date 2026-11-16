import { lookup as dnsLookup } from 'node:dns'
import type { LookupAddress } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { LookupFunction } from 'node:net'

export const MAX_DOCUMENT_BYTES = 10 * 1024
export const FETCH_TIMEOUT_MS = 5000

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

// BlockList also matches IPv4 lookups against IPv6 rules, so ::ffff:0:0/96 cannot be a rule.
const MAPPED_IPV4 = /^::ffff:(?:0:)?(\d{1,3}(?:\.\d{1,3}){3})$/i

export function isPublicAddress(address: string): boolean {
	const family = isIP(address)
	if (family === 0) return false
	if (family === 6) {
		const mapped = MAPPED_IPV4.exec(address)?.[1]
		if (mapped !== undefined) return isPublicAddress(mapped)
		if (/^::ffff:/i.test(address)) return false
	}
	return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

export class MetadataFetchError extends Error {}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
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

export function fetchMetadataDocument(clientId: string): Promise<FetchedDocument> {
	const url = new URL(clientId)
	if (isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0) {
		return Promise.reject(new MetadataFetchError('Client id urls must use a host name'))
	}
	return new Promise((resolve, reject) => {
		const outgoing = request(
			url,
			{
				method: 'GET',
				lookup: guardedLookup,
				headers: { accept: 'application/json' },
				timeout: FETCH_TIMEOUT_MS,
			},
			(response) => {
				if (response.statusCode !== 200) {
					response.resume()
					reject(new MetadataFetchError(`Metadata document answered ${response.statusCode}`))
					return
				}
				const chunks: Buffer[] = []
				let size = 0
				response.on('data', (chunk: Buffer) => {
					size += chunk.length
					if (size > MAX_DOCUMENT_BYTES) {
						outgoing.destroy(new MetadataFetchError('Metadata document is too large'))
						return
					}
					chunks.push(chunk)
				})
				response.on('end', () => {
					try {
						const header = response.headers['cache-control']
						resolve({
							body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
							cacheControl: typeof header === 'string' ? header : null,
						})
					} catch {
						reject(new MetadataFetchError('Metadata document is not JSON'))
					}
				})
				response.on('error', reject)
			}
		)
		outgoing.on('timeout', () =>
			outgoing.destroy(new MetadataFetchError('Metadata fetch timed out'))
		)
		outgoing.on('error', (error) =>
			reject(error instanceof MetadataFetchError ? error : new MetadataFetchError(error.message))
		)
		outgoing.end()
	})
}
