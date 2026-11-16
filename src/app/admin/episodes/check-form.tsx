'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/app/components/submit-button'
import type { Verdict } from '@/lib/episode-types'
import { saveCheck } from './actions'
import type { CheckResult } from './actions'

export function CheckForm({
	episodeId,
	segmentIndex,
	current,
}: {
	episodeId: number
	segmentIndex: number
	current: { verdict: Verdict; note: string } | null
}) {
	const [result, action] = useActionState<CheckResult, FormData>(saveCheck, {
		status: 'idle',
		message: '',
	})
	const id = `check-${segmentIndex}`
	return (
		<form action={action} className="flex flex-wrap items-end gap-2">
			<input type="hidden" name="episodeId" value={episodeId} />
			<input type="hidden" name="segmentIndex" value={segmentIndex} />
			<div>
				<label htmlFor={`${id}-verdict`} className="label">
					Spot check
				</label>
				<select
					id={`${id}-verdict`}
					name="verdict"
					defaultValue={current?.verdict ?? ''}
					required
					className="input w-auto"
				>
					<option value="" disabled>
						Unchecked
					</option>
					<option value="correct">Correct</option>
					<option value="error">Error</option>
					<option value="unclear">Unclear</option>
				</select>
			</div>
			<div className="min-w-40 flex-1">
				<label htmlFor={`${id}-note`} className="label">
					Note
				</label>
				<input
					id={`${id}-note`}
					name="note"
					maxLength={2000}
					autoComplete="off"
					defaultValue={current?.note ?? ''}
					className="input"
				/>
			</div>
			<SubmitButton>Save</SubmitButton>
			{result.status !== 'idle' && (
				<p
					role={result.status === 'error' ? 'alert' : 'status'}
					className={result.status === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}
				>
					{result.message}
				</p>
			)}
		</form>
	)
}
