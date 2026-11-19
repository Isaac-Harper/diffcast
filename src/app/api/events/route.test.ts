import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const state = vi.hoisted(() => ({ recorded: [] as string[] }))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))

vi.mock('@/lib/store/events', () => ({
	recordEvent: async (kind: string) => {
		state.recorded.push(kind)
	},
}))

function beacon(body: string, ip: string): Request {
	return new Request('https://diffcast.fm/api/events', {
		method: 'POST',
		headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': ip },
		body,
	})
}

beforeEach(() => {
	state.recorded = []
})

describe('browser events route', () => {
	it('records a landing view and a sample play from a beacon', async () => {
		expect((await POST(beacon('{"kind":"landing_view"}', '192.0.2.1'))).status).toBe(204)
		expect((await POST(beacon('{"kind":"sample_play"}', '192.0.2.1'))).status).toBe(204)
		expect(state.recorded).toEqual(['landing_view', 'sample_play'])
	})

	it('refuses server side kinds and bodies that are not JSON', async () => {
		expect((await POST(beacon('{"kind":"paid"}', '192.0.2.2'))).status).toBe(400)
		expect((await POST(beacon('not json', '192.0.2.2'))).status).toBe(400)
		expect(state.recorded).toEqual([])
	})

	it('throttles each address after 30 events in ten minutes', async () => {
		for (let index = 0; index < 30; index += 1) {
			await POST(beacon('{"kind":"landing_view"}', '192.0.2.3'))
		}
		expect((await POST(beacon('{"kind":"landing_view"}', '192.0.2.3'))).status).toBe(429)
		expect((await POST(beacon('{"kind":"landing_view"}', '192.0.2.4'))).status).toBe(204)
		expect(state.recorded).toHaveLength(31)
	})
})
