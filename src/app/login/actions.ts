'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { clientIp, loginFailures, recordLoginFailure } from '@/lib/login-throttle'
import { authConfig, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/session'

export async function login(formData: FormData) {
	const config = authConfig()
	if (!config) redirect('/login')

	const ip = await clientIp()
	if (loginFailures.blocked(ip)) redirect('/login?error=throttled')

	const password = formData.get('password')
	if (typeof password !== 'string' || !safeEqual(password, config.password)) {
		await recordLoginFailure(ip)
		redirect('/login?error=invalid')
	}

	loginFailures.clear(ip)
	;(await cookies()).set(SESSION_COOKIE, signSession(config.signingKey), {
		httpOnly: true,
		secure: process.env['NODE_ENV'] === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: SESSION_MAX_AGE,
	})
	redirect('/admin')
}

export async function logout() {
	;(await cookies()).delete(SESSION_COOKIE)
	redirect('/login')
}
