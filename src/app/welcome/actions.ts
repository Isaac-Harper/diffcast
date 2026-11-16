'use server'

import { headers } from 'next/headers'
import { welcomeState } from '@/lib/billing/welcome'
import { feedUrl, hashFeedToken, listenerPageUrl, newFeedToken } from '@/lib/feed-tokens'
import { requestOrigin } from '@/lib/http'
import { claimWelcome } from '@/lib/store/billing'
import { addFeedToken } from '@/lib/store/feed-tokens'

export type WelcomeResult =
	| { status: 'idle' }
	| { status: 'error'; message: string }
	| { status: 'issued'; feedUrl: string; pageUrl: string }

export async function revealWelcomeLinks(
	_previous: WelcomeResult,
	form: FormData
): Promise<WelcomeResult> {
	const sessionId = form.get('sessionId')
	if (typeof sessionId !== 'string') return { status: 'error', message: 'Unknown checkout.' }
	const state = await welcomeState(sessionId)
	if (state.kind !== 'ready') {
		return {
			status: 'error',
			message:
				state.kind === 'shown'
					? 'These links were already shown. Check your email, or sign in for a new link.'
					: 'Your subscription is still being set up. Refresh in a moment.',
		}
	}
	const listenerId = await claimWelcome(sessionId, state.customerId)
	if (listenerId === null) {
		return {
			status: 'error',
			message: 'These links were already shown. Check your email, or sign in for a new link.',
		}
	}
	const token = newFeedToken()
	await addFeedToken(listenerId, 'Welcome page', hashFeedToken(token))
	const origin = requestOrigin(await headers())
	return {
		status: 'issued',
		feedUrl: feedUrl(origin, token),
		pageUrl: listenerPageUrl(origin, token),
	}
}
