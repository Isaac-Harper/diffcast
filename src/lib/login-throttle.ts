import { headers } from 'next/headers'
import { forwardedIp, pause, Throttle } from './throttle'

const MAX_FAILURES = 5
const WINDOW_MS = 10 * 60 * 1000
const FAILURE_DELAY_MS = 500

export const loginFailures = new Throttle(MAX_FAILURES, WINDOW_MS)

export async function clientIp(): Promise<string> {
	return forwardedIp((await headers()).get('x-forwarded-for'))
}

export async function recordLoginFailure(ip: string): Promise<void> {
	loginFailures.add(ip)
	await pause(FAILURE_DELAY_MS)
}
