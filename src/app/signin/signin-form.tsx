'use client'

import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { useActionState } from 'react'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { requestSignIn } from './actions'
import type { SignInResult } from './actions'

const IDLE: SignInResult = { status: 'idle', message: '' }

export function SignInForm() {
	const [result, action] = useActionState(requestSignIn, IDLE)
	if (result.status === 'saved') {
		return (
			<p role="status" className="rounded-card border border-add bg-add-soft p-5 text-pretty">
				{result.message}
			</p>
		)
	}
	return (
		<form action={action} className="space-y-4">
			<Field name="email">
				<FieldLabel>Email</FieldLabel>
				<Input type="email" required autoComplete="email" spellCheck={false} maxLength={320} />
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton variant="solid">Email me a sign in link</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}
