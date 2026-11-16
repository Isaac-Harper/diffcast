import { currentMailer } from './email/resend-mailer'
import { signInEmail } from './email/templates'
import { hashLoginToken, LOGIN_TOKEN_TTL_MS, newLoginToken } from './listener-session'
import { safeReturnPath } from './return-path'
import { signInByEmail } from './signin'
import { addLoginToken } from './store/login-tokens'

export function claimSignInEmail(email: string): boolean {
	const key = email.trim().toLowerCase()
	if (signInByEmail.blocked(key)) return false
	signInByEmail.add(key)
	return true
}

export async function sendSignInLink(
	listener: { id: number; email: string },
	origin: string,
	next: unknown
): Promise<void> {
	const token = newLoginToken()
	await addLoginToken(listener.id, hashLoginToken(token), new Date(Date.now() + LOGIN_TOKEN_TTL_MS))
	const safeNext = safeReturnPath(next)
	const url = `${origin}/signin/confirm?token=${token}${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ''}`
	await currentMailer().send(signInEmail({ to: listener.email, url }))
}
