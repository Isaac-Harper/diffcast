import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
	LISTENER_COOKIE,
	LISTENER_SESSION_MAX_AGE,
	listenerSigningKey,
	signListenerSession,
	verifyListenerSession,
} from './listener-session'

export async function sessionListenerId(): Promise<number | null> {
	const token = (await cookies()).get(LISTENER_COOKIE)?.value
	return verifyListenerSession(token, listenerSigningKey())
}

export async function requireListener(): Promise<number> {
	const listenerId = await sessionListenerId()
	if (listenerId === null) redirect('/signin')
	return listenerId
}

export async function startListenerSession(listenerId: number): Promise<void> {
	;(await cookies()).set(LISTENER_COOKIE, signListenerSession(listenerId, listenerSigningKey()), {
		httpOnly: true,
		secure: process.env['NODE_ENV'] === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: LISTENER_SESSION_MAX_AGE,
	})
}

export async function endListenerSession(): Promise<void> {
	;(await cookies()).delete(LISTENER_COOKIE)
}
