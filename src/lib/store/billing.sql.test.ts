import { describe, expect, it, vi } from 'vitest'
import { syncSubscription } from './billing'
import type { SubscriptionState } from './billing'
import { businessCounts } from './business'
import { getListener } from './listeners'

vi.mock('../db', async () => {
	const { createTestDatabase } = await import('@/test/pglite')
	return createTestDatabase()
})

const db = (await import('../db')) as unknown as {
	query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
}

const PERIOD_END = new Date('2026-12-18T10:00:00Z')
let counter = 0

async function subscriber(comped = false): Promise<{ listenerId: number; subscriptionId: string }> {
	counter += 1
	const subscriptionId = `sub_${counter}`
	const rows = await db.query(
		`INSERT INTO listeners (name, email, timezone, comped, stripe_customer_id,
			stripe_subscription_id, subscription_status, current_period_end)
		VALUES ('Test', 'test@example.com', 'UTC', $1, $2, $3, 'active', $4) RETURNING id`,
		[comped, `cus_${counter}`, subscriptionId, PERIOD_END.toISOString()]
	)
	return { listenerId: rows[0]?.['id'] as number, subscriptionId }
}

function state(subscriptionId: string, overrides: Partial<SubscriptionState>): SubscriptionState {
	return {
		subscriptionId,
		status: 'active',
		periodEnd: PERIOD_END,
		cancelAt: null,
		cancelRequestedAt: null,
		...overrides,
	}
}

describe('subscription sync', () => {
	it('records a scheduled cancel while service continues, then ends service once', async () => {
		const { listenerId, subscriptionId } = await subscriber()
		const requested = new Date('2026-11-18T09:00:00Z')
		const scheduled = await syncSubscription(
			state(subscriptionId, { cancelAt: PERIOD_END, cancelRequestedAt: requested })
		)
		expect(scheduled?.serviceEnded).toBe(false)
		expect(await getListener(listenerId)).toMatchObject({
			subscription_status: 'active',
			service_ended_at: null,
		})
		expect(new Date((await getListener(listenerId))?.cancel_at ?? '')).toEqual(PERIOD_END)
		expect(new Date((await getListener(listenerId))?.cancel_requested_at ?? '')).toEqual(requested)
		expect((await businessCounts()).canceling).toBeGreaterThanOrEqual(1)

		const ended = await syncSubscription(
			state(subscriptionId, {
				status: 'canceled',
				cancelAt: PERIOD_END,
				cancelRequestedAt: requested,
			})
		)
		expect(ended).toMatchObject({
			previousStatus: 'active',
			status: 'canceled',
			serviceEnded: true,
		})
		const endedAt = (await getListener(listenerId))?.service_ended_at
		expect(endedAt).not.toBeNull()

		const replay = await syncSubscription(state(subscriptionId, { status: 'canceled' }))
		expect(replay?.serviceEnded).toBe(false)
		expect((await getListener(listenerId))?.service_ended_at).toBe(endedAt)
		expect((await businessCounts()).endedThisWeek).toBeGreaterThanOrEqual(1)
	})

	it('clears a renewed cancel and the end of service when it is served again', async () => {
		const { listenerId, subscriptionId } = await subscriber()
		await syncSubscription(state(subscriptionId, { cancelAt: PERIOD_END }))
		await syncSubscription(state(subscriptionId, {}))
		expect((await getListener(listenerId))?.cancel_at).toBeNull()

		await syncSubscription(state(subscriptionId, { status: 'unpaid' }))
		expect((await getListener(listenerId))?.service_ended_at).not.toBeNull()
		await syncSubscription(state(subscriptionId, {}))
		expect((await getListener(listenerId))?.service_ended_at).toBeNull()
	})

	it('treats past_due as served and never ends service for a comped listener', async () => {
		const paying = await subscriber()
		expect(
			(await syncSubscription(state(paying.subscriptionId, { status: 'past_due' })))?.serviceEnded
		).toBe(false)
		const comped = await subscriber(true)
		const change = await syncSubscription(state(comped.subscriptionId, { status: 'canceled' }))
		expect(change?.serviceEnded).toBe(false)
		expect((await getListener(comped.listenerId))?.service_ended_at).toBeNull()
	})

	it('answers null for a subscription it does not know', async () => {
		expect(await syncSubscription(state('sub_unknown', {}))).toBeNull()
	})
})
