import { lookup } from 'node:dns'
import { createServer, request } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveClient } from './clients'
import { fetchMetadataDocument, MetadataFetchError, readDocument } from './fetch-metadata-document'
import { failedClientIds, metadataFetches } from './throttles'

const state = vi.hoisted(() => ({ fetches: [] as string[], fail: true }))

vi.mock('../db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('../store/oauth', () => ({
	getClient: async () => null,
	saveMetadataClient: async () => undefined,
}))
vi.mock('./fetch-metadata-document', async (importOriginal) => {
	const original = await importOriginal<typeof import('./fetch-metadata-document')>()
	return {
		...original,
		fetchMetadataDocument: async (url: string) => {
			state.fetches.push(url)
			if (state.fail) throw new original.MetadataFetchError('answered 404')
			return {
				body: { client_id: url, client_name: 'Agent', redirect_uris: ['http://localhost:1/cb'] },
				cacheControl: null,
			}
		},
	}
})

let server: Server | null = null

async function serve(handler: Parameters<typeof createServer>[1]): Promise<URL> {
	server = createServer(handler)
	await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
	const { port } = server.address() as AddressInfo
	return new URL(`http://127.0.0.1:${port}/client.json`)
}

const LOCAL = { request, lookup, deadlineMs: 300 }

afterEach(async () => {
	server?.closeAllConnections()
	await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
	server = null
})

describe('reading a metadata document', () => {
	it('gives up at the total deadline even while bytes keep dripping in', async () => {
		let closed = false
		const url = await serve((incoming, response) => {
			response.writeHead(200, { 'content-type': 'application/json' })
			response.write('{')
			const drip = setInterval(() => response.write(' '), 50)
			incoming.socket.on('close', () => {
				closed = true
				clearInterval(drip)
			})
		})
		const started = Date.now()
		await expect(readDocument(url, LOCAL)).rejects.toThrow(/300 ms deadline/)
		expect(Date.now() - started).toBeLessThan(1000)
		await vi.waitFor(() => expect(closed).toBe(true))
	})

	it('reads a small JSON document with its cache header, refuses big or failing ones', async () => {
		const url = await serve((incoming, response) => {
			if (incoming.url === '/client.json') {
				response.writeHead(200, { 'cache-control': 'max-age=600' })
				response.end('{"client_id":"x"}')
			} else if (incoming.url === '/big.json') {
				response.writeHead(200)
				response.end(`"${'x'.repeat(20 * 1024)}"`)
			} else {
				response.writeHead(404)
				response.end()
			}
		})
		await expect(readDocument(url, LOCAL)).resolves.toEqual({
			body: { client_id: 'x' },
			cacheControl: 'max-age=600',
		})
		await expect(readDocument(new URL('/big.json', url), LOCAL)).rejects.toThrow(/too large/)
		await expect(readDocument(new URL('/missing.json', url), LOCAL)).rejects.toThrow(/404/)
	})
})

describe('fetching a client id metadata document', () => {
	it('refuses other ports and literal IP hosts before any network', async () => {
		const original = await vi.importActual<typeof import('./fetch-metadata-document')>(
			'./fetch-metadata-document'
		)
		for (const url of [
			'https://client.example.com:8443/c.json',
			'https://93.184.216.34/c.json',
			'https://[2606:4700::1111]/c.json',
		]) {
			await expect(original.fetchMetadataDocument(url), url).rejects.toBeInstanceOf(
				original.MetadataFetchError
			)
		}
		expect(fetchMetadataDocument).toBeTypeOf('function')
		expect(MetadataFetchError).toBeTypeOf('function')
	})
})

describe('resolving clients', () => {
	beforeEach(() => {
		state.fetches = []
		state.fail = true
		failedClientIds.clear()
		metadataFetches.clear()
	})

	it('caches a failed client id for 5 minutes', async () => {
		const id = 'https://agent.example.com/client.json'
		expect(await resolveClient(id, '198.51.100.1')).toBeNull()
		expect(await resolveClient(id, '198.51.100.2')).toBeNull()
		expect(state.fetches).toEqual([id])
		vi.useFakeTimers({ now: Date.now() + 5 * 60 * 1000 + 1 })
		try {
			state.fail = false
			expect(await resolveClient(id, '198.51.100.3')).toMatchObject({ name: 'Agent' })
			expect(state.fetches).toEqual([id, id])
		} finally {
			vi.useRealTimers()
		}
	})

	it('throttles metadata fetches per IP', async () => {
		for (let index = 0; index < 12; index += 1) {
			await resolveClient(`https://agent${index}.example.com/client.json`, '198.51.100.9')
		}
		expect(state.fetches).toHaveLength(10)
		await resolveClient('https://other.example.com/client.json', '198.51.100.10')
		expect(state.fetches).toHaveLength(11)
	})
})
