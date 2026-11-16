'use client'

import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Textarea } from '@ui-sdk/react/textarea'
import { useActionState } from 'react'
import { ChoiceGroup } from '@/app/components/choice-group'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import type { Listened, Useful } from '@/lib/episode-types'
import { IDLE } from '@/lib/form-result'
import { emailMySignInLink, submitFeedback } from './actions'

export function SignInLinkForm({ token }: { token: string }) {
	const [result, action] = useActionState(emailMySignInLink, IDLE)
	return (
		<form action={action} className="flex flex-wrap items-center gap-3 pt-2">
			<input type="hidden" name="token" value={token} />
			<SubmitButton>Email me a sign in link</SubmitButton>
			{result.status === 'idle' ? (
				<span className="text-sm text-muted">
					For billing, your stack, new feed links and connecting your coding agent.
				</span>
			) : (
				<FormStatus status={result.status} message={result.message} />
			)}
		</form>
	)
}

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
