import { z } from 'zod'
import type { Parsed } from './forms'
import { Throttle } from './throttle'

export const PODCAST_APPS = [
	'Apple Podcasts',
	'Overcast',
	'Pocket Casts',
	'Spotify',
	'Castro',
	'AntennaPod',
	'Other',
] as const

export const MAX_STACK_TEXT = 20000

export const waitlistAttempts = new Throttle(5, 10 * 60 * 1000)

const APP_ERROR = 'Pick a podcast app from the list.'

const waitlistSchema = z.object({
	email: z
		.string()
		.trim()
		.max(320, 'Enter a valid email address.')
		.pipe(z.email('Enter a valid email address.')),
	podcastApp: z
		.string()
		.trim()
		.refine(
			(value) => value === '' || (PODCAST_APPS as readonly string[]).includes(value),
			APP_ERROR
		)
		.transform((value) => value || null),
	stackText: z
		.string()
		.trim()
		.max(MAX_STACK_TEXT, `Keep the stack under ${MAX_STACK_TEXT} characters.`),
})

function field(form: FormData, key: string): string {
	const value = form.get(key)
	return typeof value === 'string' ? value : ''
}

export function parseWaitlistForm(
	form: FormData
): Parsed<{ email: string; podcastApp: string | null; stackText: string }> {
	const parsed = waitlistSchema.safeParse({
		email: field(form, 'email'),
		podcastApp: field(form, 'podcastApp'),
		stackText: field(form, 'stack'),
	})
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
	}
	return { ok: true, input: parsed.data }
}

export function waitlistName(email: string): string {
	const local = (email.split('@')[0] ?? '').split('+')[0] ?? ''
	const words = local.split(/[._-]+/).filter(Boolean)
	if (words.length === 0) return local
	return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
