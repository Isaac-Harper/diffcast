'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/app/components/submit-button'
import type { Listened, Useful, WouldPay } from '@/lib/episode-types'
import { submitFeedback, submitSurvey } from './actions'
import type { FormResult } from './actions'

const IDLE: FormResult = { status: 'idle', message: '' }

function Status({ result }: { result: FormResult }) {
	if (result.status === 'idle') return null
	return (
		<p
			role={result.status === 'error' ? 'alert' : 'status'}
			className={result.status === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}
		>
			{result.message}
		</p>
	)
}

function Choice({
	name,
	value,
	label,
	defaultChecked,
}: {
	name: string
	value: string
	label: string
	defaultChecked: boolean
}) {
	return (
		<label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm select-none has-checked:border-zinc-900 has-checked:bg-zinc-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-zinc-400 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900">
			<input
				type="radio"
				name={name}
				value={value}
				defaultChecked={defaultChecked}
				className="sr-only"
			/>
			{label}
		</label>
	)
}

export function SurveyForm({
	token,
	current,
}: {
	token: string
	current: { wouldPay: WouldPay; note: string } | null
}) {
	const [result, action] = useActionState(submitSurvey, IDLE)
	return (
		<form action={action} className="space-y-3">
			<input type="hidden" name="token" value={token} />
			<fieldset className="flex flex-wrap gap-2">
				<legend className="sr-only">Would you pay</legend>
				<Choice
					name="wouldPay"
					value="yes"
					label="Yes"
					defaultChecked={current?.wouldPay === 'yes'}
				/>
				<Choice
					name="wouldPay"
					value="maybe"
					label="Maybe"
					defaultChecked={current?.wouldPay === 'maybe'}
				/>
				<Choice name="wouldPay" value="no" label="No" defaultChecked={current?.wouldPay === 'no'} />
			</fieldset>
			<label htmlFor="survey-note" className="sr-only">
				Note
			</label>
			<textarea
				id="survey-note"
				name="note"
				rows={2}
				maxLength={2000}
				defaultValue={current?.note ?? ''}
				placeholder="Anything that would change your answer?"
				className="input"
			/>
			<div className="flex items-center gap-3">
				<SubmitButton primary>Save answer</SubmitButton>
				<Status result={result} />
			</div>
		</form>
	)
}

export function FeedbackForm({
	token,
	episodeId,
	current,
}: {
	token: string
	episodeId: number
	current: { listened: Listened; useful: Useful | null; note: string } | null
}) {
	const [result, action] = useActionState(submitFeedback, IDLE)
	return (
		<form action={action} className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
			<input type="hidden" name="token" value={token} />
			<input type="hidden" name="episodeId" value={episodeId} />
			<fieldset className="flex flex-wrap items-center gap-2">
				<legend className="mb-1 text-sm font-medium">Did you listen?</legend>
				<Choice
					name="listened"
					value="yes"
					label="Yes"
					defaultChecked={current?.listened === 'yes'}
				/>
				<Choice
					name="listened"
					value="partly"
					label="Partly"
					defaultChecked={current?.listened === 'partly'}
				/>
				<Choice name="listened" value="no" label="No" defaultChecked={current?.listened === 'no'} />
			</fieldset>
			<fieldset className="flex flex-wrap items-center gap-2">
				<legend className="mb-1 text-sm font-medium">Useful?</legend>
				<Choice name="useful" value="up" label="Useful" defaultChecked={current?.useful === 'up'} />
				<Choice
					name="useful"
					value="down"
					label="Not useful"
					defaultChecked={current?.useful === 'down'}
				/>
			</fieldset>
			<label htmlFor={`note-${episodeId}`} className="sr-only">
				Note
			</label>
			<textarea
				id={`note-${episodeId}`}
				name="note"
				rows={2}
				maxLength={2000}
				defaultValue={current?.note ?? ''}
				placeholder="What should tomorrow do differently?"
				className="input"
			/>
			<div className="flex items-center gap-3">
				<SubmitButton>Send feedback</SubmitButton>
				<Status result={result} />
			</div>
		</form>
	)
}
