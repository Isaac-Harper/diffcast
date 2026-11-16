'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requestOrigin } from '@/lib/http'
import { sessionListenerId } from '@/lib/listener-auth'
import { consentState } from '@/lib/oauth/consent'
import { CODE_SECONDS } from '@/lib/oauth/metadata'
import { withQuery } from '@/lib/oauth/redirect-uris'
import { hashSecret, newOpaqueSecret } from '@/lib/oauth/secrets'
import { addCode } from '@/lib/store/oauth'

export async function decideAuthorization(form: FormData): Promise<void> {
	const query = form.get('query')
	if (typeof query !== 'string') throw new Error('Consent form posted without its query')
	const params = new URLSearchParams(query)
	const origin = requestOrigin(await headers())
	const state = await consentState(params, origin, await sessionListenerId())
	if (state.kind === 'needs_session' || state.kind === 'not_served') {
		redirect(`/oauth/authorize?${params.toString()}`)
	}
	if (state.kind === 'show_error') redirect(`/oauth/authorize?${params.toString()}`)
	if (state.kind === 'redirect_error') {
		redirect(
			withQuery(state.redirectUri, {
				error: state.error,
				error_description: state.description,
				state: state.state,
				iss: origin,
			})
		)
	}
	const { request, listener } = state
	if (form.get('decision') !== 'allow') {
		redirect(
			withQuery(request.redirectUri, {
				error: 'access_denied',
				error_description: 'The listener declined.',
				state: request.state,
				iss: origin,
			})
		)
	}
	const code = newOpaqueSecret()
	await addCode({
		codeHash: hashSecret('code', code),
		clientId: request.clientId,
		listenerId: listener.id,
		redirectUri: request.redirectUri,
		codeChallenge: request.codeChallenge,
		resource: request.resource,
		scope: request.scope,
		expiresAt: new Date(Date.now() + CODE_SECONDS * 1000),
	})
	redirect(withQuery(request.redirectUri, { code, state: request.state, iss: origin }))
}
