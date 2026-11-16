import { z } from 'zod'
import { MAX_INTEREST_NOTE, MAX_INTERESTS, MAX_TAKE, MAX_TOPIC } from '../interests'

export const MAX_PACKAGES = 200
export const MAX_CONTEXT_TOPICS = 20
export const MAX_SUMMARY = 300
export const MAX_EPISODES = 14

const PROJECT = /^[a-z0-9._/-]{1,80}$/
const ECOSYSTEM_PREFIX = /^(npm|pypi|cargo|go|rubygems):/
const PACKAGE_PATTERNS = [
	/^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/,
	/^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/,
	/^[A-Za-z][A-Za-z0-9_-]{0,63}$/,
	/^[a-z0-9.-]+\.[a-z]{2,}(\/[A-Za-z0-9._~-]+)+$/,
]
const FORBIDDEN = /[\s"'`{}[\];<>\\]/
const PLAIN_WORDS = /^[\p{L}\p{N}][\p{L}\p{N} .,+#&'()/-]*$/u

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export function isPlausiblePackage(value: string): boolean {
	if (value.length === 0 || value.length > 214 || FORBIDDEN.test(value)) return false
	const name = value.replace(ECOSYSTEM_PREFIX, '')
	return name.length > 0 && PACKAGE_PATTERNS.some((pattern) => pattern.test(name))
}

export function isPlainWords(value: string): boolean {
	return PLAIN_WORDS.test(value) && !/[\n\r]/.test(value)
}

const projectSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(PROJECT, 'project must be 1 to 80 characters of a-z, 0-9, dot, underscore, slash or dash')

const topicSchema = z
	.string()
	.trim()
	.min(1)
	.max(MAX_TOPIC)
	.refine(isPlainWords, 'Topics are plain words, one line each.')

export const pushContextInput = z.object({
	project: projectSchema.describe(
		'A repo name or alias for what you are working on, e.g. acme/api.'
	),
	packages: z
		.array(
			z
				.string()
				.trim()
				.refine(
					isPlausiblePackage,
					'Each package must be a plain package name, e.g. next or npm:next.'
				)
		)
		.max(MAX_PACKAGES)
		.optional()
		.describe(
			'Package names the project depends on, optionally prefixed npm:, pypi:, cargo:, go: or rubygems:.'
		),
	topics: z
		.array(topicSchema)
		.max(MAX_CONTEXT_TOPICS)
		.optional()
		.describe('Technical topics the work touches this week, in plain words.'),
	summary: z
		.string()
		.trim()
		.max(MAX_SUMMARY)
		.refine(
			(value) => value === '' || isPlainWords(value),
			'Keep the summary to one line of plain words.'
		)
		.optional()
		.describe('What the developer is doing, in plain words. Never read out in an episode.'),
})

export const clearContextInput = z.object({
	project: projectSchema.optional().describe('Clear only this project. Omit to clear everything.'),
})

const interestInput = z.object({
	topic: topicSchema,
	take: z.string().trim().max(MAX_TAKE).optional(),
	note: z.string().trim().max(MAX_INTEREST_NOTE).optional(),
	active: z.boolean().optional(),
})

export const setInterestsInput = z.object({
	interests: z.array(interestInput).min(1).max(MAX_INTERESTS),
})

export const addInterestInput = interestInput

export const removeInterestInput = z.object({ topic: z.string().trim().min(1).max(MAX_TOPIC) })

export const setDaysInput = z.object({
	days: z.array(z.enum(DAY_KEYS)).min(1).max(7),
})

export const listEpisodesInput = z.object({
	limit: z.number().int().min(1).max(MAX_EPISODES).optional(),
})

export const noInput = z.object({})

export function dayNumbers(days: readonly DayKey[]): number[] {
	return [...new Set(days.map((day) => DAY_KEYS.indexOf(day) + 1))].sort((a, b) => a - b)
}

export function dayKeys(days: readonly number[]): DayKey[] {
	return days.map((day) => {
		const key = DAY_KEYS[day - 1]
		if (!key) throw new Error(`Not an ISO weekday: ${day}`)
		return key
	})
}
