import type { AuthInfo } from '@modelcontextprotocol/server'
import { findAccessToken, touchGrant } from '../store/oauth'
import { resourceFor, sameResource } from './metadata'
import { hashSecret, isOpaqueSecret } from './secrets'

export interface DiffcastAuth {
	listenerId: number
	grantId: number
}

export async function verifyAccessToken(
	token: string | undefined,
	origin: string
): Promise<AuthInfo | undefined> {
	if (!token || !isOpaqueSecret(token)) return undefined
	const row = await findAccessToken(hashSecret('access', token))
	if (!row || !sameResource(row.resource, resourceFor(origin))) return undefined
	await touchGrant(row.grantId)
	const extra: DiffcastAuth & Record<string, unknown> = {
		listenerId: row.listenerId,
		grantId: row.grantId,
	}
	return {
		token,
		clientId: row.clientId,
		scopes: row.scope.split(' '),
		expiresAt: Math.floor(row.expiresAt),
		resource: new URL(row.resource),
		extra,
	}
}

export function diffcastAuth(authInfo: AuthInfo | undefined): DiffcastAuth {
	const listenerId = authInfo?.extra?.['listenerId']
	const grantId = authInfo?.extra?.['grantId']
	if (typeof listenerId !== 'number' || typeof grantId !== 'number') {
		throw new Error('MCP request reached a tool without verified Diffcast auth')
	}
	return { listenerId, grantId }
}
