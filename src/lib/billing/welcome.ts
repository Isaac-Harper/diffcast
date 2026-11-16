import Stripe from 'stripe'
import { welcomeListener } from '../store/billing'
import { PROJECT_METADATA, stripe } from './stripe'

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/

export type WelcomeState =
	| { kind: 'invalid' }
	| { kind: 'pending' }
	| { kind: 'ready' | 'shown'; customerId: string; listenerId: number }

async function retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
	try {
		return await stripe().checkout.sessions.retrieve(sessionId)
	} catch (error) {
		if (error instanceof Stripe.errors.StripeInvalidRequestError) return null
		throw error
	}
}

export async function welcomeState(sessionId: string): Promise<WelcomeState> {
	if (!SESSION_ID.test(sessionId)) return { kind: 'invalid' }
	const session = await retrieveSession(sessionId)
	if (!session || session.metadata?.['project'] !== PROJECT_METADATA.project) {
		return { kind: 'invalid' }
	}
	const customer = session.customer
	const customerId = typeof customer === 'string' ? customer : (customer?.id ?? null)
	if (session.status !== 'complete' || customerId === null) return { kind: 'pending' }
	const listener = await welcomeListener(sessionId, customerId)
	if (!listener) return { kind: 'pending' }
	return {
		kind: listener.shown ? 'shown' : 'ready',
		customerId,
		listenerId: listener.listenerId,
	}
}
