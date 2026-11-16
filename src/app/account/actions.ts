'use server'

import { refresh } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { portalConfigurationId, stripe } from '@/lib/billing/stripe'
import { feedUrl, hashFeedToken, listenerPageUrl, newFeedToken } from '@/lib/feed-tokens'
import type { FormResult } from '@/lib/form-result'
import { parseDaysForm, parseProfileForm, wholeId } from '@/lib/forms'
import { requestOrigin } from '@/lib/http'
import { parseInterestsEditor } from '@/lib/interests-form'
import { requireListener } from '@/lib/listener-auth'
import { addFeedToken, revokeListenerFeedTokens } from '@/lib/store/feed-tokens'
import { saveInterests } from '@/lib/store/interests'
import { revokeListenerGrant } from '@/lib/store/oauth'
import { getListener, setListenerDays, setListenerProfile } from '@/lib/store/listeners'

export type FeedLinkResult =
	{ status: 'idle' } | { status: 'issued'; feedUrl: string; pageUrl: string; revoked: boolean }

export async function saveAccountInterests(
	_previous: FormResult,
	form: FormData
): Promise<FormResult> {
	const listenerId = await requireListener()
	const parsed = parseInterestsEditor(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await saveInterests(listenerId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Interests saved. They shape your next episode.' }
}

export async function saveAccountDays(_previous: FormResult, form: FormData): Promise<FormResult> {
	const listenerId = await requireListener()
	const parsed = parseDaysForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await setListenerDays(listenerId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Days saved.' }
}

export async function saveAccountProfile(
	_previous: FormResult,
	form: FormData
): Promise<FormResult> {
	const listenerId = await requireListener()
	const parsed = parseProfileForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await setListenerProfile(listenerId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Saved.' }
}

export async function disconnectAgent(form: FormData): Promise<void> {
	const listenerId = await requireListener()
	const grantId = wholeId(form.get('grantId'))
	if (grantId === null) throw new Error('Disconnect posted without a grant id')
	if (!(await revokeListenerGrant(listenerId, grantId))) {
		throw new Error(`Grant ${grantId} does not belong to listener ${listenerId}`)
	}
	refresh()
}

export async function openBillingPortal(): Promise<void> {
	const listenerId = await requireListener()
	const listener = await getListener(listenerId)
	if (!listener?.stripe_customer_id)
		throw new Error(`Listener ${listenerId} has no Stripe customer`)
	const portal = await stripe().billingPortal.sessions.create({
		customer: listener.stripe_customer_id,
		configuration: portalConfigurationId(),
		return_url: `${requestOrigin(await headers())}/account`,
	})
	redirect(portal.url)
}

export async function issueAccountFeedLink(
	_previous: FeedLinkResult,
	form: FormData
): Promise<FeedLinkResult> {
	const listenerId = await requireListener()
	const revoke = form.get('revokeOld') === 'on'
	if (revoke) await revokeListenerFeedTokens(listenerId)
	const token = newFeedToken()
	await addFeedToken(listenerId, 'Account', hashFeedToken(token))
	const origin = requestOrigin(await headers())
	return {
		status: 'issued',
		feedUrl: feedUrl(origin, token),
		pageUrl: listenerPageUrl(origin, token),
		revoked: revoke,
	}
}
