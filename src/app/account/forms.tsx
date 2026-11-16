'use client'

import { Checkbox, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Textarea } from '@ui-sdk/react/textarea'
import { useActionState } from 'react'
import { FeedLinks } from '@/app/components/feed-links'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { IDLE } from '@/lib/form-result'
import { issueAccountFeedLink, saveAccountProfile } from './actions'
import type { FeedLinkResult } from './actions'

export function ProfileForm({
	timezone,
	focus,
	stackLines,
	timeZones,
}: {
	timezone: string
	focus: string
	stackLines: string
	timeZones: readonly string[]
}) {
	const [result, action] = useActionState(saveAccountProfile, IDLE)
	return (
		<form action={action} className="space-y-4">
			<input type="hidden" name="format" value="auto" />
			<Field name="timezone">
				<FieldLabel>Time zone</FieldLabel>
				<Input
					required
					list="account-time-zones"
					autoComplete="off"
					spellCheck={false}
					maxLength={100}
					defaultValue={timezone}
				/>
				<datalist id="account-time-zones">
					{timeZones.map((zone) => (
						<option key={zone} value={zone} />
					))}
				</datalist>
			</Field>
			<Field name="focus">
				<FieldLabel>What you work on</FieldLabel>
				<Textarea rows={3} maxLength={2000} defaultValue={focus} />
				<FieldDescription>
					In your own words. It steers story choice and is never read out.
				</FieldDescription>
			</Field>
			<Field name="stack">
				<FieldLabel>Your stack</FieldLabel>
				<Textarea
					rows={6}
					spellCheck={false}
					defaultValue={stackLines}
					className="font-mono text-sm"
					placeholder="Paste package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, a Gemfile, or one package per line"
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<SubmitButton variant="solid">Save</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}

export function NewFeedLink() {
	const [result, action] = useActionState<FeedLinkResult, FormData>(issueAccountFeedLink, {
		status: 'idle',
	})
	return (
		<div className="space-y-4">
			<form action={action} className="space-y-3">
				<label className="flex items-center gap-2 text-sm">
					<Checkbox name="revokeOld">
						<CheckboxIndicator>
							<svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
								<path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
							</svg>
						</CheckboxIndicator>
					</Checkbox>
					Stop my old feed links working
				</label>
				<SubmitButton>Get a new feed link</SubmitButton>
			</form>
			{result.status === 'issued' && (
				<>
					{result.revoked && (
						<p role="status" className="text-sm text-add">
							Old links revoked. Update your podcast app with the new feed URL.
						</p>
					)}
					<FeedLinks feedUrl={result.feedUrl} pageUrl={result.pageUrl} />
				</>
			)}
		</div>
	)
}
