import { createHash, createHmac, randomBytes } from 'node:crypto'
import { MIN_SECRET_LENGTH, safeEqual } from './session'

export const LISTENER_COOKIE = 'diffcast_listener'
export const LISTENER_SESSION_MAX_AGE = 60 * 60 * 24 * 30
export const LOGIN_TOKEN_TTL_MS = 30 * 60 * 1000

const LOGIN_TOKEN = /^[0-9a-f]{64}$/

export function listenerSigningKey(env: Record<string, string | undefined> = process.env): string {
	const secret = env['DIFFCAST_SESSION_SECRET']
	if (!secret || secret.length < MIN_SECRET_LENGTH) {
		throw new Error(`DIFFCAST_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`)
	}
	return createHmac('sha256', secret).update('diffcast-listener-session').digest('base64url')
}

function hmac(payload: string, key: string): string {
	return createHmac('sha256', key).update(payload).digest('base64url')
}

export function signListenerSession(listenerId: number, key: string, now: number = Date.now()) {
	const payload = `${listenerId}.${now + LISTENER_SESSION_MAX_AGE * 1000}`
	return `${payload}.${hmac(payload, key)}`
}

export function verifyListenerSession(
	token: string | undefined,
	key: string,
	now: number = Date.now()
): number | null {
	if (!token) return null
	const parts = token.split('.')
	if (parts.length !== 3) return null
	const [id, expires, signature] = parts as [string, string, string]
	if (!/^\d{1,9}$/.test(id) || !/^\d{1,15}$/.test(expires)) return null
	if (!safeEqual(signature, hmac(`${id}.${expires}`, key))) return null
	if (Number(expires) <= now) return null
	const listenerId = Number(id)
	return listenerId > 0 ? listenerId : null
}

export function newLoginToken(): string {
	return randomBytes(32).toString('hex')
}

export function hashLoginToken(token: string): string {
	return createHash('sha256').update(`login:${token}`).digest('hex')
}

export function isLoginToken(value: string): boolean {
	return LOGIN_TOKEN.test(value)
}
