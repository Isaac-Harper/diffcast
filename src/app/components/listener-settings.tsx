'use client'

import { useActionState } from 'react'
import type { InterestRow } from '@/lib/interests'
import type { FormResult } from '@/lib/form-result'
import { IDLE } from '@/lib/form-result'
import { DaysField } from './days-field'
import { FormStatus } from './form-status'
import { InterestsEditor } from './interests-editor'
import { SubmitButton } from './submit-button'

export type SettingsAction = (previous: FormResult, form: FormData) => Promise<FormResult>

function HiddenFields({ fields }: { fields: Readonly<Record<string, string>> }) {
	return Object.entries(fields).map(([name, value]) => (
		<input key={name} type="hidden" name={name} value={value} />
	))
}

export function InterestsForm({
	action,
	hidden = {},
	interests,
}: {
	action: SettingsAction
	hidden?: Readonly<Record<string, string>>
	interests: readonly InterestRow[]
}) {
	const [result, formAction] = useActionState(action, IDLE)
	return (
		<form action={formAction} className="space-y-4">
			<HiddenFields fields={hidden} />
			<InterestsEditor initial={interests} />
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton variant="solid">Save interests</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}

export function DaysForm({
	action,
	hidden = {},
	days,
}: {
	action: SettingsAction
	hidden?: Readonly<Record<string, string>>
	days: readonly number[]
}) {
	const [result, formAction] = useActionState(action, IDLE)
	return (
		<form action={formAction} className="space-y-4">
			<HiddenFields fields={hidden} />
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
