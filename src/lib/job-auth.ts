import { safeEqual } from './session'
import { pause, requestIp, Throttle } from './throttle'

export const JOB_PATH_PREFIX = '/api/jobs/'
export const MIN_JOB_TOKEN_LENGTH = 32

const MAX_FAILURES = 10
const WINDOW_MS = 10 * 60 * 1000
const FAILURE_DELAY_MS = 500

export const jobFailures = new Throttle(MAX_FAILURES, WINDOW_MS)

export function jobToken(env: Record<string, string | undefined> = process.env): string | null {
	const value = env['DIFFCAST_JOB_TOKEN']
	if (!value || value.length < MIN_JOB_TOKEN_LENGTH) return null
	return value
}

export function bearerToken(header: string | null): string | null {
	const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '')
	return match?.[1] ?? null
}

export function verifyJobToken(header: string | null, expected: string | null): boolean {
	if (!expected) return false
	const given = bearerToken(header)
	if (!given) return false
	return safeEqual(given, expected)
}

export async function checkJobRequest(
	request: Request,
	options: { now?: number; delayMs?: number } = {}
): Promise<Response | null> {
	const now = options.now ?? Date.now()
	if (verifyJobToken(request.headers.get('authorization'), jobToken())) return null
	const ip = requestIp(request)
	if (jobFailures.blocked(ip, now)) {
		return Response.json({ error: 'Too many requests' }, { status: 429 })
	}
	jobFailures.add(ip, now)
	await pause(options.delayMs ?? FAILURE_DELAY_MS)
	return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
