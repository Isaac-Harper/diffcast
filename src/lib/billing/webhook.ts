import type Stripe from 'stripe'
import { currentMailer } from '../email/resend-mailer'
import { subscriptionEndedEmail, welcomeEmail } from '../email/templates'
import { feedUrl, hashFeedToken, listenerPageUrl, newFeedToken } from '../feed-tokens'
import { DEFAULT_INTERESTS } from '../interests'
import { describeNextEpisode, nextEpisode } from '../next-episode'
import { SERVED_STATUSES } from '../served'
import { nameFromEmail } from '../signup'
import { parseStack } from '../stack-parser'
import {
	listenerForSubscription,
	markSignupCompleted,
	signupForSession,
	syncSubscription,
	upsertPaidListener,
} from '../store/billing'
import type { SubscriptionState } from '../store/billing'
import { latestEpisodeDate } from '../store/episodes'
import { addFeedToken, revokeFeedToken } from '../store/feed-tokens'
import { PROJECT_METADATA, stripe } from './stripe'

export type EventOutcome = 'handled' | 'ignored'

const PAID = new Set<Stripe.Checkout.Session.PaymentStatus>(['paid', 'no_payment_required'])

function objectId(value: string | { id: string } | null | undefined): string | null {
	if (value === null || value === undefined) return null
	return typeof value === 'string' ? value : value.id
}

export function subscriptionState(subscription: Stripe.Subscription): SubscriptionState {
	const periodEnd = subscription.items.data[0]?.current_period_end
	return {
		subscriptionId: subscription.id,
		status: subscription.status,
		periodEnd: periodEnd === undefined ? null : new Date(periodEnd * 1000),
	}
}

async function retrieveSubscription(id: string): Promise<SubscriptionState> {
	return subscriptionState(await stripe().subscriptions.retrieve(id))
}

function isServedStatus(status: string | null): boolean {
	return (SERVED_STATUSES as readonly string[]).includes(status ?? '')
}

async function completeCheckout(
	session: Stripe.Checkout.Session,
	origin: string
): Promise<EventOutcome> {
	if (session.metadata?.['project'] !== PROJECT_METADATA.project) return 'ignored'
	if (session.mode !== 'subscription' || !PAID.has(session.payment_status)) return 'ignored'
	const signup = await signupForSession(session.id)
	if (!signup) throw new Error(`Checkout session ${session.id} has no signup row`)
	if (signup.completed_at !== null) return 'handled'
	const customerId = objectId(session.customer)
	const subscriptionId = objectId(session.subscription)
	if (!customerId || !subscriptionId) {
		throw new Error(`Checkout session ${session.id} has no customer or subscription`)
	}
	const stack = parseStack(signup.stack_text)
	if (!stack.ok) throw new Error(`Signup ${signup.id} stack no longer parses: ${stack.error}`)
	const listener = await upsertPaidListener({
		signupId: signup.id,
		name: nameFromEmail(signup.email),
		email: signup.email,
		timezone: signup.timezone,
		focus: signup.interests_text,
		topics: signup.topics.length > 0 ? signup.topics : DEFAULT_INTERESTS,
		stack: stack.dependencies,
		days: signup.days,
		customerId,
		subscription: await retrieveSubscription(subscriptionId),
	})
	await stripe().customers.update(customerId, { metadata: { ...PROJECT_METADATA } })
	const token = newFeedToken()
	const now = new Date()
	const first = nextEpisode(
		now,
		listener.timezone,
		listener.days,
		await latestEpisodeDate(listener.id)
	)
	const tokenId = await addFeedToken(listener.id, 'Welcome email', hashFeedToken(token))
	try {
		await currentMailer().send(
			welcomeEmail({
				to: signup.email,
				feedUrl: feedUrl(origin, token),
				pageUrl: listenerPageUrl(origin, token),
				firstEpisode: describeNextEpisode(now, first, listener.timezone),
			})
		)
	} catch (error) {
		await revokeFeedToken(tokenId)
		throw error
	}
	await markSignupCompleted(signup.id)
	return 'handled'
}

async function refreshSubscription(subscriptionId: string): Promise<EventOutcome> {
	if ((await listenerForSubscription(subscriptionId)) === null) return 'ignored'
	const change = await syncSubscription(await retrieveSubscription(subscriptionId))
	if (!change) return 'ignored'
	const ended = isServedStatus(change.previousStatus) && !isServedStatus(change.status)
	if (ended && !change.comped && change.email) {
		await currentMailer().send(subscriptionEndedEmail({ to: change.email }))
	}
	return 'handled'
}

function invoiceSubscription(invoice: Stripe.Invoice): string | null {
	return objectId(invoice.parent?.subscription_details?.subscription)
}

export async function handleStripeEvent(
	event: Stripe.Event,
	origin: string
): Promise<EventOutcome> {
	switch (event.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded':
			return completeCheckout(event.data.object, origin)
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted':
			return refreshSubscription(event.data.object.id)
		case 'invoice.paid': {
			const subscriptionId = invoiceSubscription(event.data.object)
			return subscriptionId === null ? 'ignored' : refreshSubscription(subscriptionId)
		}
		default:
			return 'ignored'
	}
}
