import { describe, expect, it, vi } from 'vitest'
import type { DueListener } from '../../../shared/contract.ts'
import { concurrencyFrom, runListeners } from './due-loop.ts'
import type { JobClient } from './job-api.ts'
import { StepFailure } from './steps.ts'

function listener(listenerId: number): DueListener {
	return {
		listenerId,
		date: '2026-11-16',
		format: 'daily',
		since: null,
		timezone: 'UTC',
		minutes: 10,
		stack: [],
		focus: '',
		interests: [],
		recent: [],
		feedback: [],
	}
}

function mockJobs(reportFailure: JobClient['reportFailure']): JobClient {
	return {
		fetchDue: vi.fn(),
		requestUpload: vi.fn(),
		saveEpisode: vi.fn(),
		reportFailure,
	}
}

describe('runListeners', () => {
	it('reports a failing listener and keeps going', async () => {
		const reportFailure = vi.fn<JobClient['reportFailure']>(async () => {})
		const produced: number[] = []
		const result = await runListeners(
			[listener(1), listener(2), listener(3)],
			async (current) => {
				if (current.listenerId === 2) throw new StepFailure('tts', 'speech answered 401')
				produced.push(current.listenerId)
			},
			mockJobs(reportFailure)
		)
		expect(produced).toEqual([1, 3])
		expect(result).toEqual({ succeeded: [1, 3], failed: [2] })
		expect(reportFailure).toHaveBeenCalledOnce()
		expect(reportFailure).toHaveBeenCalledWith({
			listenerId: 2,
			date: '2026-11-16',
			step: 'tts',
			message: 'speech answered 401',
		})
	})

	it('survives a failure report that itself fails', async () => {
		const reportFailure = vi.fn<JobClient['reportFailure']>(async () => {
			throw new Error('network down')
		})
		const result = await runListeners(
			[listener(1), listener(2)],
			async (current) => {
				if (current.listenerId === 1) throw new StepFailure('validate', 'x'.repeat(3000))
			},
			mockJobs(reportFailure)
		)
		expect(result).toEqual({ succeeded: [2], failed: [1] })
		expect(reportFailure.mock.calls[0]?.[0]).toMatchObject({ step: 'validate' })
	})

	it('runs at most the concurrency limit at once and keeps input order in the result', async () => {
		let running = 0
		let peak = 0
		const finished: number[] = []
		const result = await runListeners(
			[1, 2, 3, 4, 5, 6, 7].map(listener),
			async (current) => {
				running += 1
				peak = Math.max(peak, running)
				await new Promise((resolve) => setTimeout(resolve, 10 * (8 - current.listenerId)))
				running -= 1
				finished.push(current.listenerId)
				if (current.listenerId === 4) throw new StepFailure('tts', 'boom')
			},
			mockJobs(vi.fn<JobClient['reportFailure']>(async () => {})),
			3
		)
		expect(peak).toBe(3)
		expect(finished).not.toEqual([1, 2, 3, 4, 5, 6, 7])
		expect(result).toEqual({ succeeded: [1, 2, 3, 5, 6, 7], failed: [4] })
	})

	it('reads DIFFCAST_CONCURRENCY, defaulting to 3 and failing on nonsense', () => {
		expect(concurrencyFrom({})).toBe(3)
		expect(concurrencyFrom({ DIFFCAST_CONCURRENCY: '5' })).toBe(5)
		expect(() => concurrencyFrom({ DIFFCAST_CONCURRENCY: '0' })).toThrow()
		expect(() => concurrencyFrom({ DIFFCAST_CONCURRENCY: 'many' })).toThrow()
	})

	it('truncates the failure message to the contract limit', async () => {
		const reportFailure = vi.fn<JobClient['reportFailure']>(async () => {})
		await runListeners(
			[listener(1)],
			async () => {
				throw new StepFailure('mix', 'x'.repeat(3000))
			},
			mockJobs(reportFailure)
		)
		expect(reportFailure.mock.calls[0]?.[0].message).toHaveLength(2000)
	})
})
