import { hashFeedToken, isFeedToken } from './feed-tokens'
import { findServedFeedToken } from './store/feed-tokens'
import type { ActiveFeedToken } from './store/feed-tokens'
import { pause, requestIp, Throttle } from './throttle'

const MAX_MISSES = 10
const WINDOW_MS = 10 * 60 * 1000
const MISS_DELAY_MS = 500

export const feedMisses = new Throttle(MAX_MISSES, WINDOW_MS)

export type MissStatus = 404 | 429

async function lookupFeedToken(token: string): Promise<ActiveFeedToken | null> {
	if (!isFeedToken(token)) return null
	return findServedFeedToken(hashFeedToken(token))
}

export async function recordMiss(ip: string, delayMs: number = MISS_DELAY_MS): Promise<MissStatus> {
	if (feedMisses.blocked(ip)) {
		await pause(delayMs)
		return 429
	}
	feedMisses.add(ip)
	await pause(delayMs)
	return 404
}

export async function feedAccess(
	ip: string,
	token: string,
	delayMs: number = MISS_DELAY_MS
): Promise<ActiveFeedToken | MissStatus> {
	if (feedMisses.blocked(ip)) {
		await pause(delayMs)
		return 429
	}
	const found = await lookupFeedToken(token)
	if (found) return found
	return recordMiss(ip, delayMs)
}

function missResponse(status: MissStatus): Response {
	return new Response(status === 429 ? 'Too many requests' : 'Not found', {
		status,
		headers: { 'content-type': 'text/plain' },
	})
}

export async function feedMiss(request: Request): Promise<Response> {
	return missResponse(await recordMiss(requestIp(request)))
}

export async function checkFeedToken(
	request: Request,
	token: string
): Promise<ActiveFeedToken | Response> {
	const access = await feedAccess(requestIp(request), token)
	return typeof access === 'number' ? missResponse(access) : access
}
