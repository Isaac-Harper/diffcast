'use client'

import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Textarea } from '@ui-sdk/react/textarea'
import { useActionState } from 'react'
import { ChoiceGroup } from '@/app/components/choice-group'
import { DaysField } from '@/app/components/days-field'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { InterestsEditor } from '@/app/components/interests-editor'
import type { InterestRow } from '@/lib/interests'
import type { Listened, Useful, WouldPay } from '@/lib/episode-types'
import { saveMyDays, saveMyInterests, submitFeedback, submitSurvey } from './actions'
import type { FormResult } from './actions'

const IDLE: FormResult = { status: 'idle', message: '' }

const WOULD_PAY_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'maybe', label: 'Maybe' },
	{ value: 'no', label: 'No' },
]

const LISTENED_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'partly', label: 'Partly' },
	{ value: 'no', label: 'No' },
]

const USEFUL_OPTIONS = [
	{ value: 'up', label: 'Useful' },
	{ value: 'down', label: 'Not useful' },
]

function EpisodeChoice({
	name,
	heading,
	episodeDate,
	options,
	defaultValue,
}: {
	name: string
	heading: string
	episodeDate: string
	options: readonly { value: string; label: string }[]
	defaultValue: string | null
}) {
	return (
		<div className="space-y-1.5">
			<p aria-hidden="true" className="text-sm font-medium">
				{heading}
			</p>
			<ChoiceGroup
				name={name}
				label={`${heading} (${episodeDate})`}
				labelHidden
				options={options}
				defaultValue={defaultValue}
			/>
		</div>
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
			<ChoiceGroup
				name="wouldPay"
				label="Would you pay $25 a month"
				labelHidden
				options={WOULD_PAY_OPTIONS}
				defaultValue={current?.wouldPay ?? null}
			/>
			<Field name="note">
				<FieldLabel className="sr-only">Survey note</FieldLabel>
				<Textarea
					rows={2}
					maxLength={2000}
					defaultValue={current?.note ?? ''}
					placeholder="Anything that would change your answer?"
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton variant="solid">Save answer</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}

export function FeedbackForm({
	token,
	episodeId,
	episodeDate,
	current,
}: {
	token: string
	episodeId: number
	episodeDate: string
	current: { listened: Listened; useful: Useful | null; note: string } | null
}) {
	const [result, action] = useActionState(submitFeedback, IDLE)
	return (
		<form action={action} className="space-y-4 border-t border-line pt-4">
			<input type="hidden" name="token" value={token} />
			<input type="hidden" name="episodeId" value={episodeId} />
			<EpisodeChoice
				name="listened"
				heading="Did you listen?"
				episodeDate={episodeDate}
				options={LISTENED_OPTIONS}
				defaultValue={current?.listened ?? null}
			/>
			<EpisodeChoice
				name="useful"
				heading="Useful?"
				episodeDate={episodeDate}
				options={USEFUL_OPTIONS}
				defaultValue={current?.useful ?? null}
			/>
			<Field name="note">
				<FieldLabel className="sr-only">Feedback note ({episodeDate})</FieldLabel>
				<Textarea
					rows={2}
					maxLength={2000}
					defaultValue={current?.note ?? ''}
					placeholder="What should tomorrow do differently?"
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton>Send feedback</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}

export function InterestsForm({
	token,
	interests,
}: {
	token: string
	interests: readonly InterestRow[]
}) {
	const [result, action] = useActionState(saveMyInterests, IDLE)
	return (
		<form action={action} className="space-y-4">
			<input type="hidden" name="token" value={token} />
			<InterestsEditor initial={interests} />
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton variant="solid">Save interests</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}

export function DaysForm({ token, days }: { token: string; days: readonly number[] }) {
	const [result, action] = useActionState(saveMyDays, IDLE)
	return (
		<form action={action} className="space-y-4">
			<input type="hidden" name="token" value={token} />
			<DaysField
				defaultDays={days}
				description="Weekdays are the daily news. Saturday is the week in your corner of tech, Sunday a short look at the week ahead. After a day off, the next episode covers everything since your last one."
			/>
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton variant="solid">Save days</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}
