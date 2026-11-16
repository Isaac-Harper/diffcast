import { parseArgs } from 'node:util'
import { STEPS } from './steps.ts'
import type { Step } from './steps.ts'

export type RunOptions = {
	listenerId: number | null
	date: string | null
	fromStep: Step | null
	dryRun: boolean
	smoke: boolean
	noUpload: boolean
	now: string | null
}

function isStep(value: string): value is Step {
	return (STEPS as readonly string[]).includes(value)
}

export function parseRunOptions(args: string[]): RunOptions {
	const { values } = parseArgs({
		args,
		strict: true,
		options: {
			listener: { type: 'string' },
			date: { type: 'string' },
			'from-step': { type: 'string' },
			'dry-run': { type: 'boolean', default: false },
			smoke: { type: 'boolean', default: false },
			'no-upload': { type: 'boolean', default: false },
			now: { type: 'string' },
		},
	})
	const listenerId = values.listener === undefined ? null : Number(values.listener)
	if (listenerId !== null && !(Number.isInteger(listenerId) && listenerId > 0)) {
		throw new Error('--listener must be a positive integer')
	}
	const date = values.date ?? null
	if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))
		throw new Error('--date must be YYYY-MM-DD')
	if (date !== null && listenerId === null) throw new Error('--date needs --listener')
	const fromStepValue = values['from-step']
	if (fromStepValue !== undefined && !isStep(fromStepValue)) {
		throw new Error(`--from-step must be one of ${STEPS.join(', ')}`)
	}
	const fromStep = fromStepValue ?? null
	if (fromStep !== null && (listenerId === null || date === null)) {
		throw new Error('--from-step needs --listener and --date')
	}
	const now = values.now ?? null
	if (now !== null && Number.isNaN(Date.parse(now))) throw new Error('--now must be an ISO instant')
	if (now !== null && fromStep !== null) throw new Error('--now has no effect with --from-step')
	if (values['dry-run'] && values.smoke) throw new Error('--dry-run and --smoke are exclusive')
	if (values.smoke && values['no-upload'])
		throw new Error('--smoke always uploads; drop --no-upload')
	return {
		listenerId,
		date,
		fromStep,
		dryRun: values['dry-run'],
		smoke: values.smoke,
		noUpload: values['no-upload'],
		now,
	}
}
