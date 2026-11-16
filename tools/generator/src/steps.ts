import type { FailureRequest } from '../../../shared/contract.ts'

export const STEPS = ['research', 'tts', 'mix', 'upload', 'save'] as const
export type Step = (typeof STEPS)[number]
export type FailureStep = FailureRequest['step']

export class StepFailure extends Error {
	readonly step: FailureStep

	constructor(step: FailureStep, message: string) {
		super(message)
		this.step = step
	}
}

export async function inStep<T>(step: FailureStep, work: () => Promise<T>): Promise<T> {
	try {
		return await work()
	} catch (error) {
		if (error instanceof StepFailure) throw error
		throw new StepFailure(step, error instanceof Error ? error.message : String(error))
	}
}
