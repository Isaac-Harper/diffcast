import { hashFeedToken, isFeedToken } from './feed-tokens'
import { findActiveFeedToken } from './store/feed-tokens'
import type { ActiveFeedToken } from './store/feed-tokens'
import { pause, requestIp, Throttle } from './throttle'

const MAX_MISSES = 10
const WINDOW_MS = 10 * 60 * 1000
const MISS_DELAY_MS = 500

export const feedMisses = new Throttle(MAX_MISSES, WINDOW_MS)

export async function lookupFeedToken(token: string): Promise<ActiveFeedToken | null> {
	if (!isFeedToken(token)) return null
	return findActiveFeedToken(hashFeedToken(token))
}

export async function recordMiss(ip: string, delayMs: number = MISS_DELAY_MS): Promise<boolean> {
	if (feedMisses.blocked(ip)) return false
	feedMisses.add(ip)
	await pause(delayMs)
	return true
}

export async function feedMiss(request: Request, delayMs?: number): Promise<Response> {
	if (!(await recordMiss(requestIp(request), delayMs))) {
		return new Response('Too many requests', {
			status: 429,
			headers: { 'content-type': 'text/plain' },
		})
	}
	return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
}

export async function checkFeedToken(
	request: Request,
	token: string
): Promise<ActiveFeedToken | Response> {
	const found = await lookupFeedToken(token)
	if (found) return found
	return feedMiss(request)
}
