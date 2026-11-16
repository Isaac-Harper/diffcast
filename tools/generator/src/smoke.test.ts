import { spawnSync } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { episodeRequestSchema } from '../../../shared/contract.ts'
import type { DueListener } from '../../../shared/contract.ts'
import { parseRunOptions } from './arguments.ts'
import { runListeners } from './due-loop.ts'
import { produceEpisode, zeroedMetrics } from './pipeline.ts'
import { createServices, selectListeners, SMOKE_MODEL } from './services.ts'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const TOKEN = 'x'.repeat(40)

type Received = { method: string; url: string; authorization: string; body: unknown }

function dueListener(listenerId: number, minutes: number): DueListener {
	return {
		listenerId,
		date: '2026-11-17',
		format: 'daily',
		since: null,
		timezone: 'Europe/Berlin',
		minutes,
		stack: [{ name: 'next', ecosystem: 'npm' }],
		focus: '',
		interests: [],
		recent: [],
		feedback: [],
		workContext: [],
	}
}

async function readBody(request: IncomingMessage): Promise<unknown> {
	let text = ''
	for await (const chunk of request) text += String(chunk)
	return text ? JSON.parse(text) : null
}

const received: Received[] = []
const server = createServer(async (request, response) => {
	const body = await readBody(request)
	const url = request.url ?? ''
	received.push({
		method: request.method ?? '',
		url,
		authorization: request.headers.authorization ?? '',
		body,
	})
	const reply = (status: number, value: unknown) => {
		response.writeHead(status, { 'content-type': 'application/json' })
		response.end(JSON.stringify(value))
	}
	if (url.startsWith('/api/jobs/due')) {
		return reply(200, { listeners: [dueListener(1, 10), dueListener(2, 10)] })
	}
	if (url === '/api/jobs/upload') {
		return reply(200, { pathname: 'episodes/2/2026-11-17.mp3', clientToken: 'client-token' })
	}
	if (url === '/api/jobs/episodes') return reply(200, { id: 7, replaced: false })
	if (url === '/api/jobs/failures') return reply(200, {})
	return reply(404, { error: 'not found' })
})

let origin = ''
beforeAll(async () => {
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('createServices for --smoke', () => {
	it('needs only the job API env', async () => {
		const options = parseRunOptions(['--smoke'])
		await expect(createServices(options, {})).rejects.toThrow(
			'missing env: DIFFCAST_URL, DIFFCAST_JOB_TOKEN'
		)
		await expect(
			createServices(options, { DIFFCAST_URL: origin, DIFFCAST_JOB_TOKEN: TOKEN })
		).resolves.toMatchObject({ metrics: { kind: 'zeroed', model: SMOKE_MODEL } })
	})

	it('rejects --dry-run and --no-upload alongside it', () => {
		expect(() => parseRunOptions(['--smoke', '--dry-run'])).toThrow('exclusive')
		expect(() => parseRunOptions(['--smoke', '--no-upload'])).toThrow('always uploads')
	})
})

describe.skipIf(!hasFfmpeg)('smoke run', () => {
	it('uses the real job API for due, upload and save with zeroed metrics', async () => {
		const workDirectory = await mkdtemp(join(tmpdir(), 'diffcast-smoke-'))
		const options = parseRunOptions(['--smoke', '--now', '2026-11-17T03:30:00Z', '--listener', '2'])
		const services = await createServices(options, {
			DIFFCAST_URL: origin,
			DIFFCAST_JOB_TOKEN: TOKEN,
		})
		const uploads: string[] = []
		const blobUpload = async (listenerId: number, date: string) => {
			const grant = await services.jobs.requestUpload(listenerId, date)
			uploads.push(grant.pathname)
			return `https://store.private.blob.vercel-storage.com/${grant.pathname}`
		}

		const listeners = await selectListeners(options, services.jobs, workDirectory)
		expect(listeners.map((listener) => listener.listenerId)).toEqual([2])

		const result = await runListeners(
			listeners,
			(listener) =>
				produceEpisode(
					listener,
					{ ...services, upload: blobUpload },
					{ workDirectory, fromStep: 'research', stopAfterMix: false }
				),
			services.jobs
		)
		expect(result).toEqual({ succeeded: [2], failed: [] })

		const due = received.find((request) => request.url.startsWith('/api/jobs/due'))
		expect(due?.url).toBe('/api/jobs/due?now=2026-11-17T03%3A30%3A00Z')
		expect(received.every((request) => request.authorization === `Bearer ${TOKEN}`)).toBe(true)
		expect(received.find((request) => request.url === '/api/jobs/upload')?.body).toEqual({
			listenerId: 2,
			date: '2026-11-17',
		})
		expect(uploads).toEqual(['episodes/2/2026-11-17.mp3'])

		const saved = episodeRequestSchema.parse(
			received.find((request) => request.url === '/api/jobs/episodes')?.body
		)
		expect(saved.metrics).toEqual(zeroedMetrics(SMOKE_MODEL))
		expect(saved).toMatchObject({
			listenerId: 2,
			date: '2026-11-17',
			audioUrl: 'https://store.private.blob.vercel-storage.com/episodes/2/2026-11-17.mp3',
		})
		expect(saved.audioBytes).toBeGreaterThan(0)
		expect(saved.durationSeconds).toBeGreaterThan(60)
		expect(received.some((request) => request.url === '/api/jobs/failures')).toBe(false)
	})
})
