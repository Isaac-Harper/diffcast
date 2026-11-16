import type { DueListener } from '../../../shared/contract.ts'
import type { JobClient } from './job-api.ts'
import { log } from './log.ts'
import { StepFailure } from './steps.ts'
import type { FailureStep } from './steps.ts'

const MAX_FAILURE_MESSAGE = 2000

export type ListenerProducer = (listener: DueListener) => Promise<void>

export type DueLoopResult = { succeeded: number[]; failed: number[] }

export async function runListeners(
	listeners: DueListener[],
	produce: ListenerProducer,
	jobs: JobClient
): Promise<DueLoopResult> {
	const result: DueLoopResult = { succeeded: [], failed: [] }
	for (const listener of listeners) {
		try {
			await produce(listener)
			result.succeeded.push(listener.listenerId)
			log(`listener ${listener.listenerId}: done for ${listener.date}`)
		} catch (error) {
			result.failed.push(listener.listenerId)
			const step: FailureStep = error instanceof StepFailure ? error.step : 'research'
			const message = error instanceof Error ? error.message : String(error)
			log(`listener ${listener.listenerId}: FAILED at ${step}: ${message}`)
			try {
				await jobs.reportFailure({
					listenerId: listener.listenerId,
					date: listener.date,
					step,
					message: message.slice(0, MAX_FAILURE_MESSAGE),
				})
			} catch (reportError) {
				const reportMessage =
					reportError instanceof Error ? reportError.message : String(reportError)
				log(`listener ${listener.listenerId}: could not report the failure: ${reportMessage}`)
			}
		}
	}
	return result
}
