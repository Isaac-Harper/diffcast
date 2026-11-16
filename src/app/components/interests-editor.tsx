'use client'

import { Button } from '@ui-sdk/react/button'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Switch, SwitchThumb } from '@ui-sdk/react/switch'
import { useRef, useState } from 'react'
import {
	INTEREST_FIELDS,
	MAX_INTEREST_NOTE,
	MAX_INTERESTS,
	MAX_TAKE,
	MAX_TOPIC,
} from '@/lib/interests'
import type { InterestRow } from '@/lib/interests'
import { INTERESTS_MARKER } from '@/lib/interests-form'

type EditorRow = { key: number; topic: string; take: string; note: string; active: boolean }

export function InterestsEditor({ initial }: { initial: readonly InterestRow[] }) {
	const nextKey = useRef(initial.length)
	const [rows, setRows] = useState<EditorRow[]>(() =>
		initial.map((row, index) => ({
			key: index,
			topic: row.topic,
			take: row.take ?? '',
			note: row.note ?? '',
			active: row.active,
		}))
	)

	function change(key: number, patch: Partial<EditorRow>) {
		setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
	}

	function move(index: number, offset: -1 | 1) {
		setRows((current) => {
			const target = index + offset
			const moved = current[index]
			const swapped = current[target]
			if (!moved || !swapped) return current
			const next = [...current]
			next[index] = swapped
			next[target] = moved
			return next
		})
	}

	function add() {
		const key = nextKey.current
		nextKey.current += 1
		setRows((current) => [...current, { key, topic: '', take: '', note: '', active: true }])
	}

	return (
		<div className="space-y-3">
			<input type="hidden" name={INTERESTS_MARKER} value="1" />
			<p className="max-w-[62ch] text-sm leading-6 text-pretty text-muted">
				Interests decide which stories make an episode, most important first. A take is where you
				stand on a topic, in a sentence: the hosts keep it in mind and will sometimes argue the
				other side. A note is anything else they should know, such as what to skip.
			</p>
			{rows.length === 0 && (
				<p className="text-sm text-muted">No interests yet. Add one to shape the episodes.</p>
			)}
			<ol className="space-y-3">
				{rows.map((row, index) => {
					const name = row.topic.trim() || `interest ${index + 1}`
					return (
						<li
							key={row.key}
							className="space-y-3 rounded-card border border-line bg-surface p-3 sm:p-4"
						>
							<input type="hidden" name={INTEREST_FIELDS.active} value={String(row.active)} />
							<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
								<label className="shrink-0">
									<Switch
										checked={row.active}
										onCheckedChange={(active) => change(row.key, { active })}
									>
										<SwitchThumb />
									</Switch>
									<span className="sr-only">Include {name}</span>
								</label>
								<Input
									name={INTEREST_FIELDS.topic}
									aria-label={`Topic ${index + 1}`}
									placeholder="A topic, tool, company or field"
									maxLength={MAX_TOPIC}
									autoComplete="off"
									value={row.topic}
									onValueChange={(topic) => change(row.key, { topic })}
									className={`min-w-40 flex-1 font-medium ${row.active ? '' : 'text-muted line-through'}`}
								/>
								<div className="flex gap-1">
									<Button
										data-variant="quiet"
										disabled={index === 0}
										onClick={() => move(index, -1)}
									>
										<span>
											Up<span className="sr-only">: move {name}</span>
										</span>
									</Button>
									<Button
										data-variant="quiet"
										disabled={index === rows.length - 1}
										onClick={() => move(index, 1)}
									>
										<span>
											Down<span className="sr-only">: move {name}</span>
										</span>
									</Button>
									<Button
										data-variant="quiet"
										onClick={() =>
											setRows((current) => current.filter((other) => other.key !== row.key))
										}
									>
										<span>
											Remove <span className="sr-only">{name}</span>
										</span>
									</Button>
								</div>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<Field>
									<FieldLabel>
										Take<span className="sr-only"> on {name}</span>
										<span className="font-normal text-muted"> (optional)</span>
									</FieldLabel>
									<Input
										name={INTEREST_FIELDS.take}
										maxLength={MAX_TAKE}
										autoComplete="off"
										value={row.take}
										onValueChange={(take) => change(row.key, { take })}
									/>
								</Field>
								<Field>
									<FieldLabel>
										Note<span className="sr-only"> on {name}</span>
										<span className="font-normal text-muted"> (optional)</span>
									</FieldLabel>
									<Input
										name={INTEREST_FIELDS.note}
										maxLength={MAX_INTEREST_NOTE}
										autoComplete="off"
										value={row.note}
										onValueChange={(note) => change(row.key, { note })}
									/>
								</Field>
							</div>
						</li>
					)
				})}
			</ol>
			<Button onClick={add} disabled={rows.length >= MAX_INTERESTS}>
				Add an interest
			</Button>
		</div>
	)
}
