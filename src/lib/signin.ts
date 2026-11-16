import { z } from 'zod'
import { Throttle } from './throttle'

export const signInByIp = new Throttle(10, 10 * 60 * 1000)
export const signInByEmail = new Throttle(3, 30 * 60 * 1000)

export const SIGN_IN_SENT =
	'If that email has a Diffcast subscription, a sign in link is on its way. It expires in 30 minutes.'

const emailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email())

export function parseSignInEmail(value: FormDataEntryValue | null): string | null {
	const parsed = emailSchema.safeParse(typeof value === 'string' ? value : '')
	return parsed.success ? parsed.data : null
}
