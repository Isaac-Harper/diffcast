import { z } from 'zod'
import type { Parsed } from './forms'
import { MAX_INTERESTS, MAX_TOPIC } from './interests'
import { normalizeDays } from './schedule'
import { parseStack } from './stack-parser'
import { Throttle } from './throttle'
import { isTimeZone } from './time'

export const MAX_STACK_TEXT = 20000
export const MAX_INTERESTS_TEXT = 2000

export const signupAttempts = new Throttle(5, 10 * 60 * 1000)

export interface SignupInput {
	email: string
	timezone: string
	topics: string[]
	interestsText: string
	stackText: string
	days: number[]
}

export const MAX_OTHER_TOPICS_TEXT = 1000

const signupSchema = z.object({
	email: z
		.string()
		.trim()
		.max(320, 'Enter a valid email address.')
		.pipe(z.email('Enter a valid email address.')),
	timezone: z
		.string()
		.trim()
		.max(100, 'Pick a valid time zone, such as America/New_York.')
		.refine(isTimeZone, 'Pick a valid time zone, such as America/New_York.'),
	interestsText: z
		.string()
		.trim()
		.max(
			MAX_INTERESTS_TEXT,
			`Keep what you want to hear about under ${MAX_INTERESTS_TEXT} characters.`
		),
	stackText: z
		.string()
		.trim()
		.max(MAX_STACK_TEXT, `Keep the stack under ${MAX_STACK_TEXT} characters.`),
})

function field(form: FormData, key: string): string {
	const value = form.get(key)
	return typeof value === 'string' ? value : ''
}

export function parseSignupTopics(form: FormData): Parsed<string[]> {
	const other = field(form, 'otherTopics')
	if (other.length > MAX_OTHER_TOPICS_TEXT) {
		return { ok: false, error: `Keep other topics under ${MAX_OTHER_TOPICS_TEXT} characters.` }
	}
	const picked = form.getAll('topics').map((value) => (typeof value === 'string' ? value : ''))
	const topics: string[] = []
	const seen = new Set<string>()
	for (const raw of [...picked, ...other.split(/[,\n]/)]) {
		const topic = raw.trim().replace(/\s+/g, ' ')
		const key = topic.toLowerCase()
		if (!topic || seen.has(key)) continue
		if (topic.length > MAX_TOPIC) {
			return { ok: false, error: `Keep each topic under ${MAX_TOPIC} characters.` }
		}
		seen.add(key)
		topics.push(topic)
	}
	if (topics.length === 0) return { ok: false, error: 'Pick at least one topic.' }
	if (topics.length > MAX_INTERESTS) {
		return { ok: false, error: `Keep it to ${MAX_INTERESTS} topics.` }
	}
	return { ok: true, input: topics }
}

export function parseSignupForm(form: FormData): Parsed<SignupInput> {
	const parsed = signupSchema.safeParse({
		email: field(form, 'email'),
		timezone: field(form, 'timezone'),
		interestsText: field(form, 'interests'),
		stackText: field(form, 'stack'),
	})
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
	}
	const days = normalizeDays(form.getAll('days'))
	if (!days) return { ok: false, error: 'Pick at least one day.' }
	const topics = parseSignupTopics(form)
	if (!topics.ok) return topics
	if (parsed.data.stackText) {
		const stack = parseStack(parsed.data.stackText)
		if (!stack.ok) return { ok: false, error: stack.error }
	}
	return { ok: true, input: { ...parsed.data, topics: topics.input, days } }
}

export function nameFromEmail(email: string): string {
	const local = (email.split('@')[0] ?? '').split('+')[0] ?? ''
	const words = local.split(/[._-]+/).filter(Boolean)
	if (words.length === 0) return local
	return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
