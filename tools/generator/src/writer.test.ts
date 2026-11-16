import { describe, expect, it, vi } from 'vitest'
import type { DueListener } from '../../../shared/contract.ts'
import type { SavedResearchNotes } from './research-notes.ts'
import { StepFailure } from './steps.ts'
import { writeWithRetry } from './writer.ts'
import type { WriterCall, WriterReply } from './writer.ts'

const listener: DueListener = {
	listenerId: 3,
	date: '2026-11-17',
	format: 'daily',
	since: '2026-11-16',
	timezone: 'UTC',
	minutes: 3,
	stack: [],
	focus: '',
	interests: [{ topic: 'Open source', take: null, note: null }],
	recent: [],
	feedback: [],
	workContext: [],
}

const notes: SavedResearchNotes = {
	stories: [
		{
			headline: 'A release',
			whatHappened: 'It shipped.',
			whyItMatters: 'It matters.',
			dates: '2026-11-16',
			interests: ['Open source'],
			packages: [],
			kind: 'news',
			challenges: null,
			sources: [{ title: 'Notes', url: 'https://example.com/notes' }],
		},
	],
	quietDay: '',
	fetched: [{ title: 'Notes', url: 'https://example.com/notes' }],
}

function episode(url: string, turnWords: number): string {
	return JSON.stringify({
		title: 'Title',
		summary: 'Summary.',
		storyCount: 1,
		segments: [
			{
				heading: 'Heading',
				kind: 'news',
				challenges: null,
				topics: ['Open source'],
				packages: [],
				sources: [{ title: 'Notes', url }],
			},
		],
		turns: [
			{ speaker: 'host', text: Array.from({ length: turnWords }, () => 'word').join(' ') },
			{ speaker: 'cohost', text: Array.from({ length: turnWords }, () => 'word').join(' ') },
		],
	})
}

function reply(text: string, cost: string): WriterReply {
	return { text, inputTokens: 1000, outputTokens: 200, providerMetadata: { gateway: { cost } } }
}

describe('writeWithRetry', () => {
	it('retries once with the problems and sums cost and tokens over both calls', async () => {
		const call = vi.fn<WriterCall>()
		call.mockResolvedValueOnce(reply(episode('https://example.com/elsewhere', 120), '0.0123'))
		call.mockResolvedValueOnce(reply(episode('https://example.com/notes', 120), '0.0100'))
		const recorded: number[] = []
		const written = await writeWithRetry(listener, notes, 'google/model', call, async (attempt) => {
			recorded.push(attempt)
		})
		expect(recorded).toEqual([1, 2])
		expect(written.record).toEqual({
			model: 'google/model',
			inputTokens: 2000,
			outputTokens: 400,
			costUsd: 0.0223,
			attempts: 2,
		})
		const retryMessages = call.mock.calls[1]?.[0] ?? []
		expect(retryMessages).toHaveLength(3)
		expect(JSON.stringify(retryMessages.at(-1))).toContain(
			'https://example.com/elsewhere, which is not in the research notes'
		)
	})

	it('fails at validate after two invalid scripts', async () => {
		const call = vi.fn<WriterCall>(async () =>
			reply(episode('https://example.com/notes', 20), '0.01')
		)
		const failure = await writeWithRetry(listener, notes, 'm', call, async () => {}).catch(
			(error: unknown) => error
		)
		expect(failure).toBeInstanceOf(StepFailure)
		expect((failure as StepFailure).step).toBe('validate')
		expect((failure as StepFailure).message).toContain('total is 40 words')
		expect(call).toHaveBeenCalledTimes(2)
	})

	it('treats unparseable output as a problem to fix', async () => {
		const call = vi.fn<WriterCall>()
		call.mockResolvedValueOnce(reply('{"title":', '0.01'))
		call.mockResolvedValueOnce(reply(episode('https://example.com/notes', 120), '0.01'))
		const written = await writeWithRetry(listener, notes, 'm', call, async () => {})
		expect(written.record.attempts).toBe(2)
		expect(JSON.stringify(call.mock.calls[1]?.[0].at(-1))).toContain('not valid JSON')
	})
})
