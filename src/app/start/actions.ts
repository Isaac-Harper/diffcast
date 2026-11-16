'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PROJECT_METADATA, priceId, stripe } from '@/lib/billing/stripe'
import { requestOrigin } from '@/lib/http'
import { clientIp } from '@/lib/login-throttle'
import { parseSignupForm, signupAttempts } from '@/lib/signup'
import { attachCheckoutSession, createSignup, returningCustomer } from '@/lib/store/billing'
import { findServedListenerByEmail } from '@/lib/store/listeners'

export type StartResult = { status: 'idle' | 'error' | 'existing'; message: string }

const INTEGRATION_IDENTIFIER = 'diffcast_start_qkvmrtzw'

export async function startCheckout(_previous: StartResult, form: FormData): Promise<StartResult> {
	const honeypot = form.get('website')
	if (typeof honeypot === 'string' && honeypot !== '') {
		return { status: 'error', message: 'Check the form and try again.' }
	}
	const ip = await clientIp()
	if (signupAttempts.blocked(ip)) {
		return { status: 'error', message: 'Too many attempts. Try again in ten minutes.' }
	}
	const parsed = parseSignupForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	signupAttempts.add(ip)
	const input = parsed.input
	if (await findServedListenerByEmail(input.email)) {
		return {
			status: 'existing',
			message: 'That email already has a Diffcast subscription. Sign in to manage it.',
		}
	}
	const signupId = await createSignup(input)
	const customer = await returningCustomer(input.email)
	const origin = requestOrigin(await headers())
	const session = await stripe().checkout.sessions.create({
		mode: 'subscription',
		line_items: [{ price: priceId(), quantity: 1 }],
		...(customer ? { customer } : { customer_email: input.email }),
		client_reference_id: String(signupId),
		metadata: { ...PROJECT_METADATA, signup_id: String(signupId) },
		subscription_data: { metadata: { ...PROJECT_METADATA } },
		allow_promotion_codes: true,
		integration_identifier: INTEGRATION_IDENTIFIER,
		success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/start?canceled=1`,
	})
	await attachCheckoutSession(signupId, session.id)
	if (!session.url) throw new Error(`Checkout session ${session.id} has no URL`)
	redirect(session.url)
}
