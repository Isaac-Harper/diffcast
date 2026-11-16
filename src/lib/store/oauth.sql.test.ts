import { describe, expect, it, vi } from 'vitest'
import { s256Challenge } from '../oauth/secrets'
import {
	addCode,
	addRegisteredClient,
	findAccessToken,
	findRefreshToken,
	redeemCode,
	revokeGrant,
	rotateRefreshToken,
} from './oauth'
import { bumpSessionEpoch, sessionEpoch } from './listeners'

vi.mock('../db', async () => {
	const { createTestDatabase } = await import('@/test/pglite')
	return createTestDatabase()
})

const db = (await import('../db')) as unknown as {
	query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
}

const RESOURCE = 'https://diffcast.fm/api/mcp'
const REDIRECT = 'http://127.0.0.1:5000/cb'
const VERIFIER = 'v'.repeat(50)
let counter = 0

function tokens(label: string) {
	return {
		accessHash: `access-${label}`,
		accessExpiresAt: new Date(Date.now() + 3600_000),
		refreshHash: `refresh-${label}`,
		refreshExpiresAt: new Date(Date.now() + 86_400_000),
	}
}

async function listener(overrides: { comped?: boolean; status?: string | null } = {}) {
	const rows = await db.query(
		`INSERT INTO listeners (name, email, timezone, comped, subscription_status)
		VALUES ('Test', 'test@example.com', 'UTC', $1, $2) RETURNING id`,
		[overrides.comped ?? true, overrides.status ?? null]
	)
	return rows[0]?.['id'] as number
}

async function setup(
	options: { expiresInMs?: number; comped?: boolean } = {}
): Promise<{ listenerId: number; clientId: string; codeHash: string }> {
	counter += 1
	const listenerId = await listener({ comped: options.comped ?? true })
	const clientId = `client-${counter}`
	await addRegisteredClient(clientId, 'Agent', [REDIRECT])
	const codeHash = `code-${counter}`
	await addCode({
		codeHash,
		clientId,
		listenerId,
		redirectUri: REDIRECT,
		codeChallenge: s256Challenge(VERIFIER),
		resource: RESOURCE,
		scope: 'diffcast',
		expiresAt: new Date(Date.now() + (options.expiresInMs ?? 600_000)),
	})
	return { listenerId, clientId, codeHash }
}

function redeem(
	base: { clientId: string; codeHash: string },
	overrides: Record<string, unknown> = {}
) {
	counter += 1
	return redeemCode({
		codeHash: base.codeHash,
		clientId: base.clientId,
		redirectUri: REDIRECT,
		codeChallenge: s256Challenge(VERIFIER),
		resource: RESOURCE,
		tokens: tokens(String(counter)),
		...overrides,
	})
}

describe('redeemCode against real SQL', () => {
	it('consumes the code, creates the grant and both tokens, and links them in one statement', async () => {
		const base = await setup()
		const outcome = await redeem(base)
		expect(outcome.status).toBe('redeemed')
		if (outcome.status !== 'redeemed') throw new Error('not redeemed')
		const [code] = await db.query(
			'SELECT used_at IS NOT NULL AS used, grant_id FROM oauth_codes WHERE code_hash = $1',
			[base.codeHash]
		)
		expect(code).toEqual({ used: true, grant_id: outcome.grantId })
		const issued = await db.query(
			'SELECT kind FROM oauth_tokens WHERE grant_id = $1 ORDER BY kind',
			[outcome.grantId]
		)
		expect(issued.map((row) => row['kind'])).toEqual(['access', 'refresh'])
		const [grant] = await db.query(
			'SELECT listener_id, client_id, resource FROM oauth_grants WHERE id = $1',
			[outcome.grantId]
		)
		expect(grant).toEqual({
			listener_id: base.listenerId,
			client_id: base.clientId,
			resource: RESOURCE,
		})
	})

	it('reports a replay with the grant id so it can be revoked', async () => {
		const base = await setup()
		const first = await redeem(base)
		const replay = await redeem(base)
		expect(replay).toEqual({
			status: 'reused',
			grantId: first.status === 'redeemed' ? first.grantId : -1,
		})
		expect(await redeem({ ...base, codeHash: 'never-issued' })).toEqual({ status: 'unknown' })
	})

	it('consumes but grants nothing on a wrong verifier, client, redirect, resource, expiry or unserved listener', async () => {
		const cases: [Parameters<typeof setup>[0], Record<string, unknown>][] = [
			[{}, { codeChallenge: s256Challenge('w'.repeat(50)) }],
			[{}, { codeChallenge: null }],
			[{}, { clientId: 'someone-else' }],
			[{}, { redirectUri: 'http://127.0.0.1:5000/other' }],
			[{}, { resource: '' }],
			[{ expiresInMs: -1000 }, {}],
			[{ comped: false }, {}],
		]
		for (const [options, overrides] of cases) {
			const base = await setup(options)
			const outcome = await redeem(base, overrides)
			expect(outcome.status, JSON.stringify({ options, overrides })).toBe('refused')
			expect(await redeem(base)).toEqual({ status: 'reused', grantId: null })
			const grants = await db.query(
				'SELECT count(*)::int AS n FROM oauth_grants WHERE listener_id = $1',
				[base.listenerId]
			)
			expect(grants[0]?.['n']).toBe(0)
		}
	})
})

describe('refresh rotation and revocation against real SQL', () => {
	it('rotates once, refuses the second rotation of the same token, and revokes everything', async () => {
		const base = await setup()
		const outcome = await redeem(base)
		if (outcome.status !== 'redeemed') throw new Error('not redeemed')
		const refreshHash = `refresh-${counter}`
		const found = await findRefreshToken(refreshHash)
		expect(found).toMatchObject({ grantId: outcome.grantId, revoked: false, served: true })
		if (!found) throw new Error('no refresh token')
		expect(await rotateRefreshToken(found.id, found.grantId, tokens('rotated-a'))).toBe(true)
		expect(await rotateRefreshToken(found.id, found.grantId, tokens('rotated-b'))).toBe(false)
		expect(await findRefreshToken(refreshHash)).toMatchObject({ revoked: true })
		expect(await findAccessToken('access-rotated-a')).toMatchObject({ grantId: outcome.grantId })
		expect(await findAccessToken('access-rotated-b')).toBeNull()
		await revokeGrant(outcome.grantId)
		expect(await findAccessToken('access-rotated-a')).toBeNull()
		expect(await findRefreshToken('refresh-rotated-a')).toMatchObject({
			revoked: true,
			grantRevoked: true,
		})
	})
})

describe('session epochs against real SQL', () => {
	it('starts at 0 and only goes up', async () => {
		const id = await listener()
		expect(await sessionEpoch(id)).toBe(0)
		expect(await bumpSessionEpoch(id)).toBe(1)
		expect(await bumpSessionEpoch(id)).toBe(2)
		expect(await sessionEpoch(id)).toBe(2)
		expect(await sessionEpoch(999_999)).toBeNull()
		await expect(bumpSessionEpoch(999_999)).rejects.toThrow()
	})
})
