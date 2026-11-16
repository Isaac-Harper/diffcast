import { describe, expect, it, vi } from 'vitest'
import type { DueListener } from '../../../shared/contract.ts'
import { runListeners } from './due-loop.ts'
import type { JobClient } from './job-api.ts'
import { StepFailure } from './steps.ts'

function listener(listenerId: number): DueListener {
	return {
		listenerId,
		date: '2026-11-16',
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
				if (current.listenerId === 2) throw new StepFailure('tts', 'elevenlabs answered 401')
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
			message: 'elevenlabs answered 401',
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
