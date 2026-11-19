import { describe, expect, it } from 'vitest'
import {
	captionsForWindow,
	chooseWindow,
	chunkWords,
	sentenceEnds,
	timeTurns,
	windowForTimes,
	wrapLines,
} from './plan.mjs'

const turns = [
	{ speaker: 'host', text: 'Opening line. Second sentence here.' },
	{ speaker: 'cohost', text: 'Reply from the cohost.' },
	{ speaker: 'cohost', text: 'More from the cohost. And then some.' },
	{ speaker: 'host', text: 'Host again with a long thought. It keeps going. And going.' },
]

describe('timeTurns', () => {
	it('lays turns out with the mix gaps', () => {
		const timed = timeTurns(turns, [10, 10, 10, 10], 40.75)
		const expected = [0, 10, 10.3, 20.3, 20.45, 30.45, 30.75, 40.75]
		timed
			.flatMap((turn) => [turn.start, turn.end])
			.forEach((seconds, index) => expect(seconds).toBeCloseTo(expected[index]))
	})

	it('refuses clips that do not add up to the episode', () => {
		expect(() => timeTurns(turns, [10, 10, 10, 10], 50)).toThrow(/add up/)
		expect(() => timeTurns(turns, [10, 10], 20)).toThrow(/4 turns but 2 clips/)
	})
})

describe('sentenceEnds', () => {
	it('finds sentence ends and always ends at the text end', () => {
		expect(sentenceEnds('One. Two? Three')).toEqual([4, 9, 15])
		expect(sentenceEnds('Version 1.2 shipped.')).toEqual([20])
	})
})

describe('chooseWindow', () => {
	const timed = timeTurns(turns, [10, 10, 10, 10], 40.75)

	it('prefers the earliest start, ending on a whole turn', () => {
		const window = chooseWindow(timed, { minSeconds: 25, maxSeconds: 35 })
		expect(window).toMatchObject({ first: 0, last: 2, start: 0, wholeTurn: true })
		expect(window.end).toBeCloseTo(30.45)
	})

	it('cuts mid turn at a sentence end when no whole turn fits', () => {
		const window = chooseWindow(timed, { minSeconds: 34, maxSeconds: 39.5 })
		expect(window).toMatchObject({ first: 0, last: 3, wholeTurn: false })
		expect(turns[3].text.slice(0, window.cutAt)).toBe(
			'Host again with a long thought. It keeps going.'
		)
	})

	it('needs both hosts', () => {
		const solo = timeTurns(turns.slice(0, 1), [40], 40)
		expect(() => chooseWindow(solo, { minSeconds: 30, maxSeconds: 45 })).toThrow(/both hosts/)
	})
})

describe('windowForTimes', () => {
	it('maps explicit times onto turns', () => {
		const timed = timeTurns(turns, [10, 10, 10, 10], 40.75)
		expect(windowForTimes(timed, 10.3, 25.45)).toMatchObject({
			first: 1,
			last: 2,
			cutAt: 18,
			wholeTurn: false,
		})
	})
})

describe('chunkWords', () => {
	it('breaks at sentence ends and at the length limit', () => {
		expect(chunkWords('Fair enough. The sample library shipped a patch release today', 24)).toEqual(
			['Fair enough.', 'The sample library', 'shipped a patch release', 'today']
		)
	})
})

describe('wrapLines', () => {
	it('wraps on words', () => {
		expect(wrapLines('shipped a patch release today', 16)).toEqual([
			'shipped a patch',
			'release today',
		])
	})
})

describe('captionsForWindow', () => {
	it('times chunks inside each turn, relative to the window, and holds over short gaps', () => {
		const timed = timeTurns(turns, [10, 10, 10, 10], 40.75)
		const captions = captionsForWindow(
			timed,
			chooseWindow(timed, { minSeconds: 15, maxSeconds: 21 }),
			{
				maxCharacters: 40,
			}
		)
		expect(captions.map((caption) => caption.text)).toEqual([
			'Opening line.',
			'Second sentence here.',
			'Reply from the cohost.',
		])
		expect(captions[0].start).toBe(0)
		expect(captions[1].end).toBe(captions[2].start)
		expect(captions[2].end).toBeCloseTo(20.3)
	})
})
