import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
	LISTENER_COOKIE,
	LISTENER_SESSION_MAX_AGE,
	listenerSigningKey,
	signListenerSession,
	verifyListenerSession,
} from './listener-session'
import { RETURN_COOKIE, safeReturnPath } from './return-path'
import { bumpSessionEpoch, sessionEpoch } from './store/listeners'

export async function sessionListenerId(): Promise<number | null> {
	const session = verifyListenerSession(
		(await cookies()).get(LISTENER_COOKIE)?.value,
		listenerSigningKey()
	)
	if (!session) return null
	const current = await sessionEpoch(session.listenerId)
	return current === session.epoch ? session.listenerId : null
}

export async function requireListener(): Promise<number> {
	const listenerId = await sessionListenerId()
	if (listenerId === null) redirect('/signin')
	return listenerId
}

async function setSessionCookie(listenerId: number, epoch: number): Promise<void> {
	;(await cookies()).set(
		LISTENER_COOKIE,
		signListenerSession({ listenerId, epoch }, listenerSigningKey()),
		{
			httpOnly: true,
			secure: process.env['NODE_ENV'] === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: LISTENER_SESSION_MAX_AGE,
		}
	)
}

export async function startListenerSession(listenerId: number): Promise<void> {
	const epoch = await sessionEpoch(listenerId)
	if (epoch === null) throw new Error(`Cannot start a session for missing listener ${listenerId}`)
	await setSessionCookie(listenerId, epoch)
}

export async function endOtherSessions(listenerId: number): Promise<void> {
	await setSessionCookie(listenerId, await bumpSessionEpoch(listenerId))
}

export async function endAllSessions(listenerId: number): Promise<void> {
	await bumpSessionEpoch(listenerId)
	;(await cookies()).delete(LISTENER_COOKIE)
}

export async function returnPathAfterSignIn(next: unknown): Promise<string> {
	const jar = await cookies()
	const remembered = jar.get(RETURN_COOKIE)?.value
	jar.delete(RETURN_COOKIE)
	return safeReturnPath(next) ?? safeReturnPath(remembered) ?? '/account'
}

export async function endListenerSession(): Promise<void> {
	;(await cookies()).delete(LISTENER_COOKIE)
}
