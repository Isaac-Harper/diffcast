import Stripe from 'stripe'
import { stripe, webhookSecret } from '@/lib/billing/stripe'
import { handleStripeEvent } from '@/lib/billing/webhook'
import { requestOrigin } from '@/lib/http'
import { forgetStripeEvent, recordStripeEvent } from '@/lib/store/billing'

export async function POST(request: Request): Promise<Response> {
	const signature = request.headers.get('stripe-signature')
	if (!signature) return Response.json({ error: 'Missing signature.' }, { status: 400 })
	const body = await request.text()
	let event: Stripe.Event
	try {
		event = stripe().webhooks.constructEvent(body, signature, webhookSecret())
	} catch (error) {
		if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
			return Response.json({ error: 'Bad signature.' }, { status: 400 })
		}
		throw error
	}
	if (!(await recordStripeEvent(event.id, event.type))) {
		return Response.json({ received: true, duplicate: true })
	}
	try {
		const outcome = await handleStripeEvent(event, requestOrigin(request.headers))
		return Response.json({ received: true, outcome })
	} catch (error) {
		await forgetStripeEvent(event.id)
		throw error
	}
}
