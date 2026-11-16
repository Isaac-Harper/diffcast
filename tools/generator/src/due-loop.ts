import type { DueListener } from '../../../shared/contract.ts'
import type { JobClient } from './job-api.ts'
import { log } from './log.ts'
import { StepFailure } from './steps.ts'
import type { FailureStep } from './steps.ts'

const MAX_FAILURE_MESSAGE = 2000

export type ListenerProducer = (listener: DueListener) => Promise<void>

export type DueLoopResult = { succeeded: number[]; failed: number[] }

export const DEFAULT_CONCURRENCY = 3

export function concurrencyFrom(environment: Record<string, string | undefined>): number {
	const raw = environment['DIFFCAST_CONCURRENCY']
	if (!raw) return DEFAULT_CONCURRENCY
	const value = Number(raw)
	if (!Number.isInteger(value) || value < 1 || value > 32) {
		throw new Error(`DIFFCAST_CONCURRENCY must be a whole number from 1 to 32, got ${raw}`)
	}
	return value
}

async function runOne(
	listener: DueListener,
	produce: ListenerProducer,
	jobs: JobClient
): Promise<boolean> {
	try {
		await produce(listener)
		log(`listener ${listener.listenerId}: done for ${listener.date}`)
		return true
	} catch (error) {
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
			const reportMessage = reportError instanceof Error ? reportError.message : String(reportError)
			log(`listener ${listener.listenerId}: could not report the failure: ${reportMessage}`)
		}
		return false
	}
}

export async function runListeners(
	listeners: DueListener[],
	produce: ListenerProducer,
	jobs: JobClient,
	concurrency: number = DEFAULT_CONCURRENCY
): Promise<DueLoopResult> {
	const outcomes: boolean[] = []
	let next = 0
	async function worker(): Promise<void> {
		while (next < listeners.length) {
			const index = next
			next += 1
			const listener = listeners[index]
			if (!listener) throw new Error(`No listener at index ${index}`)
			outcomes[index] = await runOne(listener, produce, jobs)
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, listeners.length) }, worker))
	return {
		succeeded: listeners.filter((_, index) => outcomes[index]).map((entry) => entry.listenerId),
		failed: listeners.filter((_, index) => !outcomes[index]).map((entry) => entry.listenerId),
	}
}
