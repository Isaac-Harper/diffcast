import type { Parsed } from './forms'
import { parseInterestRows } from './interests'
import type { InterestRow } from './interests'

export const INTERESTS_MARKER = 'interestsEditor'

export function hasInterestsEditor(form: FormData): boolean {
	return form.get(INTERESTS_MARKER) === '1'
}

export function parseInterestsEditor(form: FormData): Parsed<InterestRow[]> {
	const parsed = parseInterestRows(form)
	if (parsed.ok && parsed.input.length === 0) {
		return { ok: false, error: 'Keep at least one interest.' }
	}
	return parsed
}
