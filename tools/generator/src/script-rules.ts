import { episodeScriptSchema, WORDS_PER_MINUTE } from '../../../shared/contract.ts'
import type { EpisodeFormat, EpisodeScript } from '../../../shared/contract.ts'

export const MAX_TURN_WORDS = 180
export const QUIET_DAY_SECONDS = 90
export const WEEK_AHEAD_MINUTES = 4

export type WordRange = { target: number; min: number; max: number }

export type ScriptCheck = { ok: true; episode: EpisodeScript } | { ok: false; problems: string[] }

export function wordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length
}

export function showMinutes(minutes: number, format: EpisodeFormat): number {
	return format === 'week_ahead' ? Math.min(minutes, WEEK_AHEAD_MINUTES) : minutes
}

export function wordRange(minutes: number, storyCount: number, format: EpisodeFormat): WordRange {
	const full = showMinutes(minutes, format) * WORDS_PER_MINUTE
	if (storyCount === 0) {
		const quiet = (QUIET_DAY_SECONDS / 60) * WORDS_PER_MINUTE
		return { target: quiet, min: Math.round(quiet * 0.6), max: Math.round(quiet * 1.5) }
	}
	const target = storyCount >= 3 ? full : Math.round(full / 2)
	return { target, min: Math.round(target * 0.8), max: Math.round(full * 1.15) }
}

export function removeDashes(text: string): string {
	return text
		.replace(/\s*[–—]\s*/g, ', ')
		.replace(/\s+/g, ' ')
		.trim()
}

export function checkScript(raw: unknown, minutes: number, format: EpisodeFormat): ScriptCheck {
	const parsed = episodeScriptSchema.safeParse(raw)
	if (!parsed.success) {
		return {
			ok: false,
			problems: parsed.error.issues.map(
				(issue) => `${issue.path.length ? issue.path.join('.') : 'episode'}: ${issue.message}`
			),
		}
	}
	const turns = parsed.data.turns.map((turn) => ({ ...turn, text: removeDashes(turn.text) }))
	const problems: string[] = []
	let words = 0
	turns.forEach((turn, index) => {
		const count = wordCount(turn.text)
		words += count
		if (count > MAX_TURN_WORDS) {
			problems.push(`turns.${index} has ${count} words, the limit is ${MAX_TURN_WORDS}`)
		}
	})
	const range = wordRange(minutes, parsed.data.storyCount, format)
	if (words < range.min || words > range.max) {
		problems.push(
			`total is ${words} words; with storyCount ${parsed.data.storyCount} it must be between ${range.min} and ${range.max}`
		)
	}
	if (problems.length) return { ok: false, problems }
	return { ok: true, episode: { ...parsed.data, turns } }
}
