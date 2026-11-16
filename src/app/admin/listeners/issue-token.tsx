'use client'

import { useActionState } from 'react'
import { CopyButton } from '@/app/components/copy-button'
import { SubmitButton } from '@/app/components/submit-button'
import { issueToken } from './actions'
import type { IssueResult } from './actions'

function UrlRow({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="label">{label}</p>
			<div className="flex items-center gap-2">
				<code className="min-w-0 flex-1 truncate rounded bg-zinc-100 px-2 py-1.5 font-mono text-xs dark:bg-zinc-900">
					{value}
				</code>
				<CopyButton value={value} label={label} />
			</div>
		</div>
	)
}

export function IssueToken({ listenerId }: { listenerId: number }) {
	const [result, action] = useActionState<IssueResult, FormData>(issueToken, { status: 'idle' })
	return (
		<div className="space-y-3">
			<form action={action} className="flex flex-wrap items-end gap-2">
				<input type="hidden" name="listenerId" value={listenerId} />
				<div className="min-w-48 flex-1">
					<label htmlFor="label" className="label">
						Token label
					</label>
					<input
						id="label"
						name="label"
						required
						maxLength={80}
						autoComplete="off"
						placeholder="Overcast"
						className="input"
					/>
				</div>
				<SubmitButton>Issue token</SubmitButton>
			</form>
			{result.status === 'error' && (
				<p role="alert" className="text-sm text-red-600">
					{result.message}
				</p>
			)}
			{result.status === 'issued' && (
				<div className="card space-y-3 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
					<p className="text-sm">Shown once. Copy both now.</p>
					<UrlRow label="Feed URL" value={result.feedUrl} />
					<UrlRow label="Listener page" value={result.pageUrl} />
				</div>
			)}
		</div>
	)
}
