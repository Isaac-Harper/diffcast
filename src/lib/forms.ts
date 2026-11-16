import { LISTENED, USEFUL, VERDICTS, WOULD_PAY } from './episode-types'
import type { Listened, Useful, Verdict, WouldPay } from './episode-types'
import { parseStack, STACK_FORMATS } from './stack-parser'
import type { StackFormat } from './stack-parser'
import type { ListenerInput } from './store/listeners'
import { isTimeZone } from './time'

export type Parsed<T> = { ok: true; input: T } | { ok: false; error: string }

export const MAX_NOTE = 2000

export function text(form: FormData, key: string, max: number): string {
	const value = form.get(key)
	return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function oneOf<T extends string>(values: readonly T[], value: string): T | null {
	return (values as readonly string[]).includes(value) ? (value as T) : null
}

export function wholeId(value: FormDataEntryValue | string | null | undefined): number | null {
	if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) return null
	const id = Number(value)
	return id > 0 ? id : null
}

export function stackFormat(form: FormData): StackFormat {
	return oneOf(STACK_FORMATS, text(form, 'format', 40)) ?? 'auto'
}

export function parseListenerForm(form: FormData): Parsed<ListenerInput> {
	const name = text(form, 'name', 120)
	if (!name) return { ok: false, error: 'Enter a name.' }
	const email = text(form, 'email', 320)
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return { ok: false, error: 'That email does not look right.' }
	}
	const timezone = text(form, 'timezone', 100)
	if (!isTimeZone(timezone)) return { ok: false, error: 'Pick a valid IANA time zone.' }
	const minutes = Number(text(form, 'minutes', 4) || '10')
	if (!Number.isInteger(minutes) || minutes < 3 || minutes > 20) {
		return { ok: false, error: 'Minutes must be a whole number from 3 to 20.' }
	}
	const rawFocus = form.get('focus')
	const focus = typeof rawFocus === 'string' ? rawFocus.trim() : ''
	if (focus.length > MAX_NOTE) return { ok: false, error: 'Keep the focus under 2000 characters.' }
	const rawStack = form.get('stack')
	const stack = parseStack(typeof rawStack === 'string' ? rawStack : '', stackFormat(form))
	if (!stack.ok) return { ok: false, error: stack.error }
	return {
		ok: true,
		input: { name, email: email || null, timezone, stack: stack.dependencies, focus, minutes },
	}
}

export function parseFeedbackForm(
	form: FormData
): Parsed<{ listened: Listened; useful: Useful | null; note: string }> {
	const listened = oneOf(LISTENED, text(form, 'listened', 10))
	if (!listened) return { ok: false, error: 'Say whether you listened.' }
	const usefulValue = text(form, 'useful', 10)
	const useful = usefulValue ? oneOf(USEFUL, usefulValue) : null
	if (usefulValue && !useful) return { ok: false, error: 'Useful must be up or down.' }
	return { ok: true, input: { listened, useful, note: text(form, 'note', MAX_NOTE) } }
}

export function parseSurveyForm(form: FormData): Parsed<{ wouldPay: WouldPay; note: string }> {
	const wouldPay = oneOf(WOULD_PAY, text(form, 'wouldPay', 10))
	if (!wouldPay) return { ok: false, error: 'Pick yes, maybe or no.' }
	return { ok: true, input: { wouldPay, note: text(form, 'note', MAX_NOTE) } }
}

export function parseSegmentCheckForm(
	form: FormData
): Parsed<{ episodeId: number; segmentIndex: number; verdict: Verdict; note: string }> {
	const episodeId = wholeId(form.get('episodeId'))
	const indexValue = text(form, 'segmentIndex', 3)
	const segmentIndex = /^\d{1,2}$/.test(indexValue) ? Number(indexValue) : null
	const verdict = oneOf(VERDICTS, text(form, 'verdict', 10))
	if (episodeId === null || segmentIndex === null) return { ok: false, error: 'Unknown segment.' }
	if (!verdict) return { ok: false, error: 'Pick a verdict.' }
	return {
		ok: true,
		input: { episodeId, segmentIndex, verdict, note: text(form, 'note', MAX_NOTE) },
	}
}

export function parseTokenLabel(form: FormData): Parsed<string> {
	const label = text(form, 'label', 80)
	if (!label) return { ok: false, error: 'Name the token, e.g. Overcast.' }
	return { ok: true, input: label }
}
