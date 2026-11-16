import { isServed } from '../served'
import { getListener } from '../store/listeners'
import type { Listener } from '../store/listeners'
import { checkAuthorizeRequest } from './authorize-request'
import type { AuthorizeCheck, AuthorizeRequest } from './authorize-request'
import { resolveClient } from './clients'

export type ConsentState =
	| Exclude<AuthorizeCheck, { kind: 'ok' }>
	| { kind: 'needs_session' }
	| { kind: 'not_served' }
	| { kind: 'ready'; request: AuthorizeRequest; listener: Listener }

export async function consentState(
	params: URLSearchParams,
	origin: string,
	listenerId: number | null
): Promise<ConsentState> {
	const client = await resolveClient(params.get('client_id'))
	const check = checkAuthorizeRequest(params, client, origin)
	if (check.kind !== 'ok') return check
	if (listenerId === null) return { kind: 'needs_session' }
	const listener = await getListener(listenerId)
	if (!listener) return { kind: 'needs_session' }
	if (!isServed(listener)) return { kind: 'not_served' }
	return { kind: 'ready', request: check.request, listener }
}
