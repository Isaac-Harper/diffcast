import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authConfig, SESSION_COOKIE, verifySession } from './session'

export async function hasSession(): Promise<boolean> {
	const config = authConfig()
	if (!config) return false
	const token = (await cookies()).get(SESSION_COOKIE)?.value
	return verifySession(token, config.signingKey)
}

export async function requireSession(): Promise<void> {
	if (!(await hasSession())) redirect('/login')
}
