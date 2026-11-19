import { describe, expect, it, vi } from 'vitest'
import { markSignupCompleted } from './billing'
import { recordEvent } from './events'

vi.mock('../db', async () => {
	const { createTestDatabase } = await import('@/test/pglite')
	return createTestDatabase()
})

const db = (await import('../db')) as unknown as {
	query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
}

async function kinds(): Promise<string[]> {
	return (await db.query('SELECT kind FROM events ORDER BY id')).map((row) => String(row['kind']))
}

describe('events', () => {
	it('records each funnel step and refuses unknown kinds', async () => {
		await recordEvent('landing_view')
		await recordEvent('cancel')
		expect(await kinds()).toEqual(['landing_view', 'cancel'])
		await expect(db.query(`INSERT INTO events (kind) VALUES ('visit')`)).rejects.toThrow()
	})

	it('records paid exactly once when a signup completes', async () => {
		await db.query('DELETE FROM events')
		const rows = await db.query(
			`INSERT INTO signups (email, timezone, interests_text, stack_text, days)
			VALUES ('a@example.com', 'UTC', '', '', '{1}') RETURNING id`
		)
		const signupId = rows[0]?.['id'] as number
		await markSignupCompleted(signupId)
		await markSignupCompleted(signupId)
		expect(await kinds()).toEqual(['paid'])
		const completed = await db.query('SELECT completed_at FROM signups WHERE id = $1', [signupId])
		expect(completed[0]?.['completed_at']).not.toBeNull()
	})
})
