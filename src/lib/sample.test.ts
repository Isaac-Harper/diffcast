import { describe, expect, it } from 'vitest'
import { parseSample } from './sample'

const valid = {
	title: 'A title',
	summary: 'A summary',
	publishedOn: '2026-11-18',
	durationSeconds: 600,
	audioBytes: 1000,
	segments: [
		{ kind: 'news', heading: 'Heading', sources: [{ title: 'Post', url: 'https://example.com' }] },
	],
}

describe('parseSample', () => {
	it('accepts the installed shape', () => {
		expect(parseSample(JSON.stringify(valid)).segments).toHaveLength(1)
	})

	it('rejects a segment without sources', () => {
		const broken = { ...valid, segments: [{ kind: 'news', heading: 'Heading', sources: [] }] }
		expect(() => parseSample(JSON.stringify(broken))).toThrow()
	})
})
