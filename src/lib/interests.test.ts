import { describe, expect, it } from 'vitest'
import { INTEREST_FIELDS, MAX_INTERESTS, parseInterestRows } from './interests'

type Row = { topic: string; take?: string; note?: string; active?: string }

function form(rows: Row[]): FormData {
	const data = new FormData()
	for (const row of rows) {
		data.append(INTEREST_FIELDS.topic, row.topic)
		data.append(INTEREST_FIELDS.take, row.take ?? '')
		data.append(INTEREST_FIELDS.note, row.note ?? '')
		data.append(INTEREST_FIELDS.active, row.active ?? 'true')
	}
	return data
}

describe('parseInterestRows', () => {
	it('trims, keeps order, and turns empty takes and notes into null', () => {
		expect(
			parseInterestRows(
				form([
					{ topic: '  Rust  ', take: ' Memory safety is overrated ', note: '' },
					{ topic: 'Chips', active: 'false', note: 'Fabs only' },
				])
			)
		).toEqual({
			ok: true,
			input: [
				{ topic: 'Rust', take: 'Memory safety is overrated', note: null, active: true },
				{ topic: 'Chips', take: null, note: 'Fabs only', active: false },
			],
		})
	})

	it('drops empty topics and case insensitive duplicates, keeping the first', () => {
		const parsed = parseInterestRows(
			form([{ topic: 'AI' }, { topic: '   ', take: 'orphan' }, { topic: 'ai', take: 'second' }])
		)
		expect(parsed).toEqual({
			ok: true,
			input: [{ topic: 'AI', take: null, note: null, active: true }],
		})
	})

	it('accepts an empty list', () => {
		expect(parseInterestRows(new FormData())).toEqual({ ok: true, input: [] })
	})

	it('rejects columns of different lengths', () => {
		const data = form([{ topic: 'AI' }])
		data.append(INTEREST_FIELDS.topic, 'Extra')
		expect(parseInterestRows(data).ok).toBe(false)
	})

	it('enforces length limits and the cap', () => {
		expect(parseInterestRows(form([{ topic: 'x'.repeat(101) }])).ok).toBe(false)
		expect(parseInterestRows(form([{ topic: 'AI', take: 'x'.repeat(501) }])).ok).toBe(false)
		expect(parseInterestRows(form([{ topic: 'AI', note: 'x'.repeat(501) }])).ok).toBe(false)
		const many = Array.from({ length: MAX_INTERESTS + 1 }, (_, index) => ({ topic: `T${index}` }))
		expect(parseInterestRows(form(many))).toEqual({ ok: false, error: 'Keep it to 40 interests.' })
		expect(parseInterestRows(form(many.slice(0, MAX_INTERESTS))).ok).toBe(true)
	})
})
