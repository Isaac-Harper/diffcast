'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requestOrigin } from '@/lib/http'
import {
	endListenerSession,
	returnPathAfterSignIn,
	startListenerSession,
} from '@/lib/listener-auth'
import { hashLoginToken, isLoginToken } from '@/lib/listener-session'
import { clientIp } from '@/lib/login-throttle'
import { parseSignInEmail, SIGN_IN_SENT, signInByIp } from '@/lib/signin'
import { claimSignInEmail, sendSignInLink } from '@/lib/signin-link'
import { consumeLoginToken } from '@/lib/store/login-tokens'
import { findServedListenerByEmail } from '@/lib/store/listeners'

export type SignInResult = { status: 'idle' | 'saved' | 'error'; message: string }

export async function requestSignIn(
	_previous: SignInResult,
	form: FormData
): Promise<SignInResult> {
	const email = parseSignInEmail(form.get('email'))
	if (email === null) return { status: 'error', message: 'Enter a valid email address.' }
	const ip = await clientIp()
	if (signInByIp.blocked(ip)) {
		return { status: 'error', message: 'Too many attempts. Try again in ten minutes.' }
	}
	signInByIp.add(ip)
	if (!claimSignInEmail(email)) return { status: 'saved', message: SIGN_IN_SENT }
	const listener = await findServedListenerByEmail(email)
	if (listener?.email) {
		await sendSignInLink(
			{ id: listener.id, email: listener.email },
			requestOrigin(await headers()),
			form.get('next')
		)
	}
	return { status: 'saved', message: SIGN_IN_SENT }
}

export async function confirmSignIn(form: FormData): Promise<void> {
	const token = form.get('token')
	if (typeof token !== 'string' || !isLoginToken(token)) redirect('/signin?error=expired')
	const listenerId = await consumeLoginToken(hashLoginToken(token))
	if (listenerId === null) redirect('/signin?error=expired')
	await startListenerSession(listenerId)
	redirect(await returnPathAfterSignIn(form.get('next')))
}

export async function signOut(): Promise<void> {
	await endListenerSession()
	redirect('/signin?signed_out=1')
}
