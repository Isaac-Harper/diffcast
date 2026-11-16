'use client'

import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Textarea } from '@ui-sdk/react/textarea'
import { useActionState, useState } from 'react'
import { FormStatus } from '../components/form-status'
import { SelectField } from '../components/select-field'
import { SubmitButton } from '../components/submit-button'
import { MAX_INTERESTS_TEXT, MAX_STACK_TEXT, PODCAST_APPS } from '@/lib/waitlist'
import { joinWaitlist } from '../waitlist/actions'
import type { WaitlistResult } from '../waitlist/actions'

const IDLE: WaitlistResult = { status: 'idle', message: '' }
const APPS = PODCAST_APPS.map((app) => ({ value: app, label: app }))

export function WaitlistForm() {
	const [result, action] = useActionState(joinWaitlist, IDLE)
	const [email, setEmail] = useState('')
	const [podcastApp, setPodcastApp] = useState('')
	const [interests, setInterests] = useState('')
	const [stack, setStack] = useState('')

	if (result.status === 'joined') {
		return (
			<div role="status" className="rounded-card border border-add bg-add-soft p-6">
				<p className="text-lg font-medium">You&apos;re on the list.</p>
				<p className="mt-1 text-muted">We&apos;ll email you when a spot opens.</p>
			</div>
		)
	}

	return (
		<form action={action} className="space-y-5">
			<Field name="email">
				<FieldLabel>Email</FieldLabel>
				<Input
					type="email"
					required
					autoComplete="email"
					spellCheck={false}
					maxLength={320}
					value={email}
					onValueChange={setEmail}
				/>
			</Field>
			<Field name="interests">
				<FieldLabel>What do you want to hear about? (optional)</FieldLabel>
				<Textarea
					rows={3}
					maxLength={MAX_INTERESTS_TEXT}
					value={interests}
					onValueChange={setInterests}
				/>
				<FieldDescription>
					Topics, tools, companies, arguments you are tired of. Your own words are fine.
				</FieldDescription>
			</Field>
			<SelectField
				name="podcastApp"
				label="Podcast app (optional)"
				options={APPS}
				value={podcastApp}
				onValueChange={setPodcastApp}
				placeholder="Choose an app"
			/>
			<Field name="stack">
				<FieldLabel>Your stack (optional)</FieldLabel>
				<Textarea
					rows={4}
					spellCheck={false}
					maxLength={MAX_STACK_TEXT}
					value={stack}
					onValueChange={setStack}
					className="font-mono text-sm"
				/>
				<FieldDescription>
					Paste a package.json or list packages, one per line. It adds a segment on days your
					packages change.
				</FieldDescription>
			</Field>
			<div className="honeypot" aria-hidden="true">
				<label>
					Website
					<input type="text" name="website" tabIndex={-1} autoComplete="off" />
				</label>
			</div>
			<div className="flex flex-wrap items-center gap-4">
				<SubmitButton variant="solid" size="lg">
					Request an invite
				</SubmitButton>
				<FormStatus status={result.status} message={result.message} />
			</div>
		</form>
	)
}
