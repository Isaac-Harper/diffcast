import { describe, expect, it } from 'vitest'
import { extractEpisodeJson } from './reply.ts'

describe('extractEpisodeJson', () => {
	it('parses a bare object', () => {
		expect(extractEpisodeJson(' {"title":"a"} ')).toEqual({ title: 'a' })
	})

	it('tolerates a json code fence', () => {
		expect(extractEpisodeJson('```json\n{"title":"a"}\n```')).toEqual({ title: 'a' })
		expect(extractEpisodeJson('```\n{"title":"a"}```')).toEqual({ title: 'a' })
	})

	it('rejects prose around the object', () => {
		expect(() => extractEpisodeJson('Here it is: {"title":"a"}')).toThrow('not a JSON object')
	})

	it('rejects invalid JSON', () => {
		expect(() => extractEpisodeJson('{"title":')).toThrow('not valid JSON')
	})
})
