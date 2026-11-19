'use client'

import { Checkbox, CheckboxGroup } from '@ui-sdk/react/checkbox'
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Textarea } from '@ui-sdk/react/textarea'
import Link from 'next/link'
import { useActionState, useState, useSyncExternalStore } from 'react'
import { DaysField } from '@/app/components/days-field'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { DEFAULT_INTERESTS, SUGGESTED_TOPICS } from '@/lib/interests'
import { ISO_WEEKDAYS } from '@/lib/schedule'
import { MAX_INTERESTS_TEXT, MAX_OTHER_TOPICS_TEXT, MAX_STACK_TEXT } from '@/lib/signup'
import { startCheckout } from './actions'
import type { StartResult } from './actions'

const IDLE: StartResult = { status: 'idle', message: '' }

function subscribeNever(): () => void {
	return () => undefined
}

function browserTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function StartForm({ timeZones }: { timeZones: readonly string[] }) {
	const [result, action] = useActionState(startCheckout, IDLE)
	const detectedZone = useSyncExternalStore(subscribeNever, browserTimeZone, () => '')
	const [zone, setZone] = useState<string | null>(null)

	return (
		<form action={action} className="space-y-6">
			<Field name="email">
				<FieldLabel>Email</FieldLabel>
				<Input type="email" required autoComplete="email" spellCheck={false} maxLength={320} />
				<FieldDescription>Your feed link and sign in links go here.</FieldDescription>
			</Field>
			<Field name="timezone">
				<FieldLabel>Time zone</FieldLabel>
				<Input
					required
					list="start-time-zones"
					autoComplete="off"
					spellCheck={false}
					maxLength={100}
					value={zone ?? detectedZone}
					onValueChange={setZone}
				/>
				<datalist id="start-time-zones">
					{timeZones.map((timeZone) => (
						<option key={timeZone} value={timeZone} />
					))}
				</datalist>
				<FieldDescription>Episodes land early in the morning, in this time zone.</FieldDescription>
			</Field>
			<DaysField
				defaultDays={ISO_WEEKDAYS}
				description="Weekdays are the daily news, Saturday the week in review, Sunday the week ahead."
			/>
			<Field>
				<FieldLabel>Topics</FieldLabel>
				<FieldDescription>
					Each episode is built from these. Keep the ones you want, add your own below.
				</FieldDescription>
				<CheckboxGroup name="topics" defaultValue={[...DEFAULT_INTERESTS]} data-chips="">
					{SUGGESTED_TOPICS.map((topic) => (
						<label key={topic}>
							<Checkbox value={topic} />
							<span>{topic}</span>
						</label>
					))}
				</CheckboxGroup>
			</Field>
			<Field name="otherTopics">
				<FieldLabel>Other topics (optional)</FieldLabel>
				<Input maxLength={MAX_OTHER_TOPICS_TEXT} placeholder="Rust, Postgres, local LLMs" />
				<FieldDescription>Separate them with commas.</FieldDescription>
			</Field>
			<Field name="stack">
				<FieldLabel>Your stack (optional)</FieldLabel>
				<Textarea
					rows={4}
					spellCheck={false}
					maxLength={MAX_STACK_TEXT}
					className="font-mono text-sm"
				/>
				<FieldDescription>
					Paste a package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod or Gemfile, or
					one package per line. It adds a segment on days your packages change.
				</FieldDescription>
			</Field>
			<Field name="interests">
				<FieldLabel>Anything else the hosts should know? (optional)</FieldLabel>
				<Textarea rows={2} maxLength={MAX_INTERESTS_TEXT} />
				<FieldDescription>
					Your role, what you are building, arguments you are tired of. Your own words are fine.
				</FieldDescription>
			</Field>
			<div className="honeypot" aria-hidden="true">
				<label>
					Website
					<input type="text" name="website" tabIndex={-1} autoComplete="off" />
				</label>
			</div>
			<div className="space-y-3">
				<div className="flex flex-wrap items-center gap-4">
					<SubmitButton variant="solid" size="lg">
						Continue to payment
					</SubmitButton>
					{result.status === 'error' && <FormStatus status="error" message={result.message} />}
				</div>
				{result.status === 'existing' && (
					<p role="alert" className="text-sm">
						{result.message}{' '}
						<Link href="/signin" className="font-medium">
							Sign in
						</Link>
					</p>
				)}
				<p className="text-sm text-muted">
					$25 a month, charged today through Stripe. Cancel any time. By continuing you agree to the{' '}
					<Link href="/terms" className="text-fg">
						terms
					</Link>
					.
				</p>
			</div>
		</form>
	)
}
