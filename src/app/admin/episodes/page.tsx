import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@ui-sdk/react/button'
import { SelectField } from '@/app/components/select-field'
import { formatMinutes, formatUsd } from '@/lib/format'
import { wholeId } from '@/lib/forms'
import { listEpisodes } from '@/lib/store/episodes'
import { listenerNames } from '@/lib/store/listeners'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Episodes' }

export default async function EpisodesPage({ searchParams }: PageProps<'/admin/episodes'>) {
	await requireSession()
	const raw = (await searchParams)['listener']
	const listenerId = wholeId(typeof raw === 'string' ? raw : null)
	const [episodes, listeners] = await Promise.all([listEpisodes(listenerId), listenerNames()])
	const listenerOptions = [
		{ value: 'all', label: 'All listeners' },
		...listeners.map((listener) => ({ value: String(listener.id), label: listener.name })),
	]

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<h1 className="text-xl font-semibold">Episodes</h1>
				<form className="flex items-end gap-2">
					<SelectField
						name="listener"
						label="Listener"
						options={listenerOptions}
						defaultValue={listenerId === null ? 'all' : String(listenerId)}
						className="min-w-48"
					/>
					<Button type="submit">Filter</Button>
				</form>
			</div>
			{episodes.length === 0 && (
				<p className="text-muted">
					No episodes. They appear after the generator runs for an active listener.
				</p>
			)}
			{episodes.length > 0 && (
				<div className="table-frame">
					<table className="data-table">
						<thead>
							<tr>
								<th>Date</th>
								<th>Listener</th>
								<th>Title</th>
								<th>Stories</th>
								<th>Length</th>
								<th>Cost</th>
								<th>Downloads</th>
								<th>Checked</th>
							</tr>
						</thead>
						<tbody>
							{episodes.map((episode) => (
								<tr key={episode.id}>
									<td className="whitespace-nowrap">{episode.published_on}</td>
									<td>{episode.listener_name}</td>
									<td>
										<Link href={`/admin/episodes/${episode.id}`} className="underline">
											{episode.title}
										</Link>
									</td>
									<td>{episode.story_count}</td>
									<td className="whitespace-nowrap">{formatMinutes(episode.duration_seconds)}</td>
									<td>{formatUsd(episode.cost_usd)}</td>
									<td>{episode.downloads}</td>
									<td>{episode.checked}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
