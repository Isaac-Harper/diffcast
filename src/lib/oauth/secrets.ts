import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/
const OPAQUE = /^[A-Za-z0-9\-_]{43}$/

export function newOpaqueSecret(): string {
	return randomBytes(32).toString('base64url')
}

export function isOpaqueSecret(value: string): boolean {
	return OPAQUE.test(value)
}

export function hashSecret(kind: 'code' | 'access' | 'refresh', secret: string): string {
	return createHash('sha256').update(`oauth-${kind}:${secret}`).digest('hex')
}

export function isCodeChallenge(value: string): boolean {
	return CHALLENGE.test(value)
}

export function s256Challenge(verifier: string): string {
	return createHash('sha256').update(verifier).digest('base64url')
}

export function verifyPkce(verifier: string, challenge: string): boolean {
	if (!VERIFIER.test(verifier) || !CHALLENGE.test(challenge)) return false
	return timingSafeEqual(Buffer.from(s256Challenge(verifier)), Buffer.from(challenge))
}
