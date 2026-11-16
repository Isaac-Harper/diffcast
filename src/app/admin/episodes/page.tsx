import type { Metadata } from 'next'
import Link from 'next/link'
import { formatMinutes, formatUsd } from '@/lib/format'
import { wholeId } from '@/lib/forms'
import { listEpisodes } from '@/lib/store/episodes'
import { listenerNames } from '@/lib/store/listeners'

export const metadata: Metadata = { title: 'Episodes' }

export default async function EpisodesPage({ searchParams }: PageProps<'/admin/episodes'>) {
	const raw = (await searchParams)['listener']
	const listenerId = wholeId(typeof raw === 'string' ? raw : null)
	const [episodes, listeners] = await Promise.all([listEpisodes(listenerId), listenerNames()])

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<h1 className="text-xl font-semibold">Episodes</h1>
				<form className="flex items-end gap-2">
					<div>
						<label htmlFor="listener" className="label">
							Listener
						</label>
						<select
							id="listener"
							name="listener"
							defaultValue={listenerId ?? ''}
							className="input w-auto"
						>
							<option value="">All listeners</option>
							{listeners.map((listener) => (
								<option key={listener.id} value={listener.id}>
									{listener.name}
								</option>
							))}
						</select>
					</div>
					<button type="submit" className="btn">
						Filter
					</button>
				</form>
			</div>
			{episodes.length === 0 && <p className="muted">No episodes.</p>}
			<div className="overflow-x-auto">
				<table className="table">
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
		</div>
	)
}
