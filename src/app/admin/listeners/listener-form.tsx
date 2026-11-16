'use client'

import { useActionState, useState, useTransition } from 'react'
import { SubmitButton } from '@/app/components/submit-button'
import type { Listener } from '@/lib/store/listeners'
import { previewStack, saveListener } from './actions'
import type { PreviewResult, SaveResult } from './actions'

const FORMATS = [
	['auto', 'Detect format'],
	['package.json', 'package.json'],
	['requirements.txt', 'requirements.txt'],
	['pyproject.toml', 'pyproject.toml'],
	['Cargo.toml', 'Cargo.toml'],
	['go.mod', 'go.mod'],
	['Gemfile', 'Gemfile'],
	['lines', 'One per line (ecosystem:name)'],
] as const

export function ListenerForm({
	listener,
	stackLines,
	timeZones,
}: {
	listener: Listener | null
	stackLines: string
	timeZones: string[]
}) {
	const [result, action] = useActionState<SaveResult, FormData>(saveListener, { error: null })
	const [stack, setStack] = useState(stackLines)
	const [format, setFormat] = useState<string>(listener ? 'lines' : 'auto')
	const [preview, setPreview] = useState<PreviewResult | null>(null)
	const [previewing, startPreview] = useTransition()

	function runPreview() {
		startPreview(async () => {
			setPreview(await previewStack(stack, format))
		})
	}

	return (
		<form action={action} className="space-y-4">
			{listener && <input type="hidden" name="id" value={listener.id} />}
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="name" className="label">
						Name
					</label>
					<input
						id="name"
						name="name"
						required
						maxLength={120}
						autoComplete="off"
						defaultValue={listener?.name ?? ''}
						className="input"
					/>
				</div>
				<div>
					<label htmlFor="email" className="label">
						Email (optional)
					</label>
					<input
						id="email"
						name="email"
						type="email"
						autoComplete="off"
						spellCheck={false}
						defaultValue={listener?.email ?? ''}
						className="input"
					/>
				</div>
				<div>
					<label htmlFor="timezone" className="label">
						Time zone
					</label>
					<input
						id="timezone"
						name="timezone"
						required
						list="time-zones"
						autoComplete="off"
						spellCheck={false}
						defaultValue={listener?.timezone ?? 'America/Los_Angeles'}
						className="input"
					/>
					<datalist id="time-zones">
						{timeZones.map((zone) => (
							<option key={zone} value={zone} />
						))}
					</datalist>
				</div>
				<div>
					<label htmlFor="minutes" className="label">
						Minutes
					</label>
					<input
						id="minutes"
						name="minutes"
						type="number"
						min={3}
						max={20}
						required
						defaultValue={listener?.minutes ?? 10}
						className="input"
					/>
				</div>
			</div>
			<div>
				<label htmlFor="focus" className="label">
					Focus (what they work on, in their words)
				</label>
				<textarea
					id="focus"
					name="focus"
					rows={4}
					maxLength={2000}
					defaultValue={listener?.focus ?? ''}
					className="input"
				/>
			</div>
			<div className="space-y-2">
				<label htmlFor="stack" className="label">
					Stack
				</label>
				<textarea
					id="stack"
					name="stack"
					rows={8}
					spellCheck={false}
					value={stack}
					onChange={(event) => {
						setStack(event.target.value)
						setPreview(null)
					}}
					placeholder="Paste package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, a Gemfile, or one package per line"
					className="input font-mono text-sm"
				/>
				<div className="flex flex-wrap items-center gap-2">
					<label htmlFor="format" className="sr-only">
						Format
					</label>
					<select
						id="format"
						name="format"
						value={format}
						onChange={(event) => {
							setFormat(event.target.value)
							setPreview(null)
						}}
						className="input w-auto"
					>
						{FORMATS.map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
					<button type="button" onClick={runPreview} disabled={previewing} className="btn">
						Preview packages
					</button>
				</div>
				{preview && !preview.ok && (
					<p role="alert" className="text-sm text-red-600">
						{preview.error}
					</p>
				)}
				{preview?.ok && (
					<div className="card text-sm">
						<p className="mb-2 font-medium">{preview.dependencies.length} packages</p>
						<ul className="flex flex-wrap gap-1.5 font-mono text-xs">
							{preview.dependencies.map((dependency) => (
								<li
									key={`${dependency.ecosystem}:${dependency.name}`}
									className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-900"
								>
									<span className="muted">{dependency.ecosystem}:</span>
									{dependency.name}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
			{result.error && (
				<p role="alert" className="text-sm text-red-600">
					{result.error}
				</p>
			)}
			<SubmitButton primary>{listener ? 'Save listener' : 'Add listener'}</SubmitButton>
		</form>
	)
}
