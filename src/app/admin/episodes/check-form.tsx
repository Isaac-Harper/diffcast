'use client'

import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { useActionState } from 'react'
import { FormStatus } from '@/app/components/form-status'
import { SelectField } from '@/app/components/select-field'
import { SubmitButton } from '@/app/components/submit-button'
import type { Verdict } from '@/lib/episode-types'
import { saveCheck } from './actions'
import type { CheckResult } from './actions'

const VERDICT_OPTIONS = [
	{ value: 'correct', label: 'Correct' },
	{ value: 'error', label: 'Error' },
	{ value: 'unclear', label: 'Unclear' },
]

export function CheckForm({
	episodeId,
	segmentIndex,
	segmentHeading,
	current,
}: {
	episodeId: number
	segmentIndex: number
	segmentHeading: string
	current: { verdict: Verdict; note: string } | null
}) {
	const [result, action] = useActionState<CheckResult, FormData>(saveCheck, {
		status: 'idle',
		message: '',
	})
	return (
		<form action={action} className="flex flex-wrap items-end gap-2">
			<input type="hidden" name="episodeId" value={episodeId} />
			<input type="hidden" name="segmentIndex" value={segmentIndex} />
			<div className="min-w-40 space-y-1.5">
				<p aria-hidden="true" className="text-sm font-medium">
					Spot check
				</p>
				<SelectField
					name="verdict"
					label={`Spot check (${segmentHeading})`}
					labelHidden
					options={VERDICT_OPTIONS}
					defaultValue={current?.verdict}
					placeholder="Unchecked"
					required
				/>
			</div>
			<Field name="note" className="min-w-40 flex-1">
				<FieldLabel>
					Note<span className="sr-only"> ({segmentHeading})</span>
				</FieldLabel>
				<Input maxLength={2000} autoComplete="off" defaultValue={current?.note ?? ''} />
			</Field>
			<SubmitButton>
				Save<span className="sr-only"> check ({segmentHeading})</span>
			</SubmitButton>
			<FormStatus status={result.status} message={result.message} />
		</form>
	)
}
