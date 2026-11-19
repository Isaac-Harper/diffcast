import type { Parsed } from './forms'

export const MAX_INTERESTS = 40
export const MAX_TOPIC = 100
export const MAX_TAKE = 500
export const MAX_INTEREST_NOTE = 500

export const INTEREST_FIELDS = {
	topic: 'topic[]',
	take: 'take[]',
	note: 'note[]',
	active: 'active[]',
} as const

export const DEFAULT_INTERESTS = [
	'AI models and agents',
	'Developer tools and web development',
	'Startups and the tech industry',
	'Security and privacy',
	'Open source',
	'Hardware and chips',
] as const

export const SUGGESTED_TOPICS = [
	...DEFAULT_INTERESTS,
	'Cloud and infrastructure',
	'Databases',
	'Programming languages',
	'Frontend frameworks',
	'Mobile development',
	'Data and machine learning engineering',
	'DevOps and platform engineering',
	'Tech policy and regulation',
] as const

export interface InterestRow {
	topic: string
	take: string | null
	note: string | null
	active: boolean
}

function strings(form: FormData, key: string): string[] {
	return form.getAll(key).map((value) => (typeof value === 'string' ? value.trim() : ''))
}

export function parseInterestRows(form: FormData): Parsed<InterestRow[]> {
	const topics = strings(form, INTEREST_FIELDS.topic)
	const takes = strings(form, INTEREST_FIELDS.take)
	const notes = strings(form, INTEREST_FIELDS.note)
	const actives = strings(form, INTEREST_FIELDS.active)
	if ([takes, notes, actives].some((column) => column.length !== topics.length)) {
		return { ok: false, error: 'Check the form and try again.' }
	}
	const rows: InterestRow[] = []
	const seen = new Set<string>()
	for (const [index, topic] of topics.entries()) {
		if (!topic) continue
		const key = topic.toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		if (topic.length > MAX_TOPIC) {
			return { ok: false, error: `Keep each topic under ${MAX_TOPIC} characters.` }
		}
		const take = takes[index] ?? ''
		if (take.length > MAX_TAKE) {
			return { ok: false, error: `Keep the take on ${topic} under ${MAX_TAKE} characters.` }
		}
		const note = notes[index] ?? ''
		if (note.length > MAX_INTEREST_NOTE) {
			return {
				ok: false,
				error: `Keep the note on ${topic} under ${MAX_INTEREST_NOTE} characters.`,
			}
		}
		rows.push({ topic, take: take || null, note: note || null, active: actives[index] === 'true' })
	}
	if (rows.length > MAX_INTERESTS) {
		return { ok: false, error: `Keep it to ${MAX_INTERESTS} interests.` }
	}
	return { ok: true, input: rows }
}
