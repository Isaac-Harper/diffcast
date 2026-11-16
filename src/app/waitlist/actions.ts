'use server'

import { clientIp } from '@/lib/login-throttle'
import { addWaitlistEntry } from '@/lib/store/waitlist'
import { parseWaitlistForm, waitlistAttempts } from '@/lib/waitlist'

export type WaitlistResult = { status: 'idle' | 'joined' | 'error'; message: string }

const JOINED: WaitlistResult = {
	status: 'joined',
	message: "You're on the list. We'll email you when a spot opens.",
}

export async function joinWaitlist(
	_previous: WaitlistResult,
	form: FormData
): Promise<WaitlistResult> {
	const honeypot = form.get('website')
	if (typeof honeypot === 'string' && honeypot !== '') return JOINED
	const ip = await clientIp()
	if (waitlistAttempts.blocked(ip)) {
		return { status: 'error', message: 'Too many attempts. Try again in ten minutes.' }
	}
	const parsed = parseWaitlistForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	waitlistAttempts.add(ip)
	await addWaitlistEntry(parsed.input)
	return JOINED
}
