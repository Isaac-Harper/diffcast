'use client'

import { Button } from '@ui-sdk/react/button'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import {
	NumberInput,
	NumberInputControl,
	NumberInputDecrement,
	NumberInputGroup,
	NumberInputIncrement,
} from '@ui-sdk/react/number-input'
import { Textarea } from '@ui-sdk/react/textarea'
import { useActionState, useState } from 'react'
import { DaysField } from '@/app/components/days-field'
import { FormStatus } from '@/app/components/form-status'
import { SelectField } from '@/app/components/select-field'
import { SubmitButton } from '@/app/components/submit-button'
import { InterestsEditor } from '@/app/components/interests-editor'
import type { InterestRow } from '@/lib/interests'
import { ISO_WEEKDAYS } from '@/lib/schedule'
import type { Listener } from '@/lib/store/listeners'
import { previewStack, saveListener } from './actions'
import type { PreviewResult, SaveResult } from './actions'

const FORMATS = [
	{ value: 'auto', label: 'Detect format' },
	{ value: 'package.json', label: 'package.json' },
	{ value: 'requirements.txt', label: 'requirements.txt' },
	{ value: 'pyproject.toml', label: 'pyproject.toml' },
	{ value: 'Cargo.toml', label: 'Cargo.toml' },
	{ value: 'go.mod', label: 'go.mod' },
	{ value: 'Gemfile', label: 'Gemfile' },
	{ value: 'lines', label: 'One per line (ecosystem:name)' },
]

export function ListenerForm({
	listener,
	interests,
	stackLines,
	timeZones,
	waitlistId,
	initialName,
	initialEmail,
	initialFocus,
}: {
	listener: Listener | null
	interests: readonly InterestRow[]
	stackLines: string
	timeZones: string[]
	waitlistId?: number
	initialName?: string
	initialEmail?: string
	initialFocus?: string
}) {
	const [result, action] = useActionState<SaveResult, FormData>(saveListener, { error: null })
	const [stack, setStack] = useState(stackLines)
	const [format, setFormat] = useState<string>(listener ? 'lines' : 'auto')
	const [preview, setPreview] = useState<PreviewResult | null>(null)

	async function runPreview() {
		setPreview(await previewStack(stack, format))
	}

	return (
		<form action={action} className="space-y-4">
			{listener && <input type="hidden" name="id" value={listener.id} />}
			{waitlistId !== undefined && <input type="hidden" name="waitlistId" value={waitlistId} />}
			<div className="grid gap-4 sm:grid-cols-2">
				<Field name="name">
					<FieldLabel>Name</FieldLabel>
					<Input
						required
						maxLength={120}
						autoComplete="off"
						defaultValue={listener?.name ?? initialName ?? ''}
					/>
				</Field>
				<Field name="email">
					<FieldLabel>Email (optional)</FieldLabel>
					<Input
						type="email"
						autoComplete="off"
						spellCheck={false}
						defaultValue={listener?.email ?? initialEmail ?? ''}
					/>
				</Field>
				<Field name="timezone">
					<FieldLabel>Time zone</FieldLabel>
					<Input
						required
						list="time-zones"
						autoComplete="off"
						spellCheck={false}
						defaultValue={listener?.timezone ?? 'America/Los_Angeles'}
					/>
					<datalist id="time-zones">
						{timeZones.map((zone) => (
							<option key={zone} value={zone} />
						))}
					</datalist>
				</Field>
				<Field>
					<FieldLabel>Minutes</FieldLabel>
					<NumberInput
						name="minutes"
						min={3}
						max={20}
						required
						defaultValue={listener?.minutes ?? 10}
					>
						<NumberInputGroup>
							<NumberInputDecrement aria-label="Decrease minutes" />
							<NumberInputControl />
							<NumberInputIncrement aria-label="Increase minutes" />
						</NumberInputGroup>
					</NumberInput>
				</Field>
			</div>
			<DaysField
				defaultDays={listener?.days ?? ISO_WEEKDAYS}
				description="Saturday is the week in review and Sunday the week ahead. Keep at least one day."
			/>
			<Field name="focus">
				<FieldLabel>Focus (what they work on, in their words)</FieldLabel>
				<Textarea rows={4} maxLength={2000} defaultValue={listener?.focus ?? initialFocus ?? ''} />
			</Field>
			<section className="space-y-3" aria-labelledby="interests-heading">
				<h2 id="interests-heading" className="text-sm font-medium">
					Interests
				</h2>
				<InterestsEditor initial={interests} />
			</section>
			<div className="space-y-2">
				<Field name="stack">
					<FieldLabel>Stack</FieldLabel>
					<Textarea
						rows={8}
						spellCheck={false}
						value={stack}
						onValueChange={(next) => {
							setStack(next)
							setPreview(null)
						}}
						placeholder="Paste package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, a Gemfile, or one package per line"
						className="font-mono text-sm"
					/>
				</Field>
				<div className="flex flex-wrap items-center gap-2">
					<SelectField
						name="format"
						label="Format"
						labelHidden
						options={FORMATS}
						value={format}
						onValueChange={(next) => {
							setFormat(next)
							setPreview(null)
						}}
						className="min-w-64"
					/>
					<Button type="button" onClick={runPreview}>
						Preview packages
					</Button>
				</div>
				{preview && !preview.ok && <FormStatus status="error" message={preview.error} />}
				{preview?.ok && (
					<div className="card text-sm">
						<p className="mb-2 font-medium">{preview.dependencies.length} packages</p>
						<ul className="flex flex-wrap gap-1.5 font-mono text-xs">
							{preview.dependencies.map((dependency) => (
								<li
									key={`${dependency.ecosystem}:${dependency.name}`}
									className="rounded-control bg-sunken px-1.5 py-0.5"
								>
									<span className="text-muted">{dependency.ecosystem}:</span>
									{dependency.name}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
			{result.error && <FormStatus status="error" message={result.error} />}
			<SubmitButton variant="solid">{listener ? 'Save listener' : 'Add listener'}</SubmitButton>
		</form>
	)
}
