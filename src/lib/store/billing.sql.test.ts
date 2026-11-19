import { describe, expect, it, vi } from 'vitest'
import {
	createSignup,
	signupForSession,
	attachCheckoutSession,
	upsertPaidListener,
} from './billing'
import { latestEpisodeDate } from './episodes'
import { listInterests } from './interests'

vi.mock('../db', async () => {
	const { createTestDatabase } = await import('@/test/pglite')
	return createTestDatabase()
})

const db = (await import('../db')) as unknown as {
	query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
}

function subscription(subscriptionId: string) {
	return { subscriptionId, status: 'active', periodEnd: null }
}

async function signup(email: string, topics: string[], sessionId: string): Promise<number> {
	const id = await createSignup({
		email,
		timezone: 'Europe/Berlin',
		topics,
		interestsText: '',
		stackText: '',
		days: [1, 3, 5],
	})
	await attachCheckoutSession(id, sessionId)
	return id
}

describe('paid listener upsert', () => {
	it('seeds the signup topics in order and returns the schedule', async () => {
		const signupId = await signup('ana@example.com', ['Rust', 'Open source'], 'cs_test_a')
		expect((await signupForSession('cs_test_a'))?.topics).toEqual(['Rust', 'Open source'])
		const listener = await upsertPaidListener({
			signupId,
			name: 'Ana',
			email: 'ana@example.com',
			timezone: 'Europe/Berlin',
			focus: '',
			topics: ['Rust', 'Open source'],
			stack: [],
			days: [1, 3, 5],
			customerId: 'cus_a',
			subscription: subscription('sub_a'),
		})
		expect(listener).toEqual({ id: expect.any(Number), timezone: 'Europe/Berlin', days: [1, 3, 5] })
		expect((await listInterests(listener.id)).map((interest) => interest.topic)).toEqual([
			'Rust',
			'Open source',
		])
		expect(await latestEpisodeDate(listener.id)).toBeNull()
	})

	it('keeps a returning listener and its own topics and schedule', async () => {
		const first = await signup('bo@example.com', ['Databases'], 'cs_test_b1')
		const original = await upsertPaidListener({
			signupId: first,
			name: 'Bo',
			email: 'bo@example.com',
			timezone: 'Asia/Tokyo',
			focus: '',
			topics: ['Databases'],
			stack: [],
			days: [6],
			customerId: 'cus_b',
			subscription: subscription('sub_b1'),
		})
		await db.query(
			`INSERT INTO episodes (listener_id, published_on, title, summary, story_count, segments, turns,
				metrics, audio_url, audio_bytes, duration_seconds)
			VALUES ($1, '2026-11-14', 'T', 'S', 3, '[]', '[]', '{}', 'a.mp3', 1, 600)`,
			[original.id]
		)
		const second = await signup('bo@example.com', ['Security and privacy'], 'cs_test_b2')
		const revived = await upsertPaidListener({
			signupId: second,
			name: 'Bo',
			email: 'bo@example.com',
			timezone: 'Europe/Berlin',
			focus: '',
			topics: ['Security and privacy'],
			stack: [],
			days: [1],
			customerId: 'cus_b',
			subscription: subscription('sub_b2'),
		})
		expect(revived).toEqual({ id: original.id, timezone: 'Asia/Tokyo', days: [6] })
		expect((await listInterests(original.id)).map((interest) => interest.topic)).toEqual([
			'Databases',
		])
		expect(await latestEpisodeDate(original.id)).toBe('2026-11-14')
	})
})
