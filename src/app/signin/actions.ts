'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { currentMailer } from '@/lib/email/resend-mailer'
import { signInEmail } from '@/lib/email/templates'
import { requestOrigin } from '@/lib/http'
import { endListenerSession, startListenerSession } from '@/lib/listener-auth'
import {
	hashLoginToken,
	isLoginToken,
	LOGIN_TOKEN_TTL_MS,
	newLoginToken,
} from '@/lib/listener-session'
import { clientIp } from '@/lib/login-throttle'
import { parseSignInEmail, SIGN_IN_SENT, signInByEmail, signInByIp } from '@/lib/signin'
import { addLoginToken, consumeLoginToken } from '@/lib/store/login-tokens'
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
	if (signInByEmail.blocked(email)) return { status: 'saved', message: SIGN_IN_SENT }
	signInByEmail.add(email)
	const listener = await findServedListenerByEmail(email)
	if (listener?.email) {
		const token = newLoginToken()
		await addLoginToken(
			listener.id,
			hashLoginToken(token),
			new Date(Date.now() + LOGIN_TOKEN_TTL_MS)
		)
		const url = `${requestOrigin(await headers())}/signin/confirm?token=${token}`
		await currentMailer().send(signInEmail({ to: listener.email, url }))
	}
	return { status: 'saved', message: SIGN_IN_SENT }
}

export async function confirmSignIn(form: FormData): Promise<void> {
	const token = form.get('token')
	if (typeof token !== 'string' || !isLoginToken(token)) redirect('/signin?error=expired')
	const listenerId = await consumeLoginToken(hashLoginToken(token))
	if (listenerId === null) redirect('/signin?error=expired')
	await startListenerSession(listenerId)
	redirect('/account')
}

export async function signOut(): Promise<void> {
	await endListenerSession()
	redirect('/signin?signed_out=1')
}
