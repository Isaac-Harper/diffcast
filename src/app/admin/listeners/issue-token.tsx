'use client'

import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { useActionState } from 'react'
import { UrlRow } from '@/app/components/feed-links'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { issueToken } from './actions'
import type { IssueResult } from './actions'

export function IssueToken({ listenerId }: { listenerId: number }) {
	const [result, action] = useActionState<IssueResult, FormData>(issueToken, { status: 'idle' })
	return (
		<div className="space-y-3">
			<form action={action} className="flex flex-wrap items-end gap-2">
				<input type="hidden" name="listenerId" value={listenerId} />
				<Field name="label" className="min-w-48 flex-1">
					<FieldLabel>Token label</FieldLabel>
					<Input required maxLength={80} autoComplete="off" placeholder="Overcast" />
				</Field>
				<SubmitButton>Issue token</SubmitButton>
			</form>
			{result.status === 'error' && <FormStatus status="error" message={result.message} />}
			{result.status === 'issued' && (
				<div className="card space-y-3 border-warn-line bg-warn-soft">
					<p className="text-sm">Shown once. Copy both now.</p>
					<UrlRow label="Feed URL" value={result.feedUrl} />
					<UrlRow label="Listener page" value={result.pageUrl} />
				</div>
			)}
		</div>
	)
}
