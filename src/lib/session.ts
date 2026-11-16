import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'diffcast_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
export const MIN_SECRET_LENGTH = 32

function hmac(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
	const left = createHash('sha256').update(a).digest()
	const right = createHash('sha256').update(b).digest()
	return timingSafeEqual(left, right)
}

export function signSession(secret: string, now: number = Date.now()): string {
	const expires = String(now + SESSION_MAX_AGE * 1000)
	return `${expires}.${hmac(expires, secret)}`
}

export function verifySession(
	token: string | undefined,
	secret: string | undefined,
	now: number = Date.now()
): boolean {
	if (!token || !secret) return false
	const [expires, signature, ...rest] = token.split('.')
	if (!expires || !signature || rest.length > 0) return false
	if (!/^\d+$/.test(expires)) return false
	if (!safeEqual(signature, hmac(expires, secret))) return false
	return Number(expires) > now
}

export function signingKey(secret: string, password: string): string {
	return createHmac('sha256', secret).update(`diffcast-session:${password}`).digest('base64url')
}

export function authConfig(
	env: Record<string, string | undefined> = process.env
): { password: string; signingKey: string } | null {
	const password = env['DIFFCAST_ADMIN_PASSWORD']
	const secret = env['DIFFCAST_SESSION_SECRET']
	if (!password || !secret || secret.length < MIN_SECRET_LENGTH) return null
	return { password, signingKey: signingKey(secret, password) }
}
