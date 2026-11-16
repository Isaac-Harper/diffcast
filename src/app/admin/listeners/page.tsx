import type { Metadata } from 'next'
import Link from 'next/link'
import { formatInstant } from '@/lib/format'
import { listListenerSummaries } from '@/lib/store/listeners'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Listeners' }

export default async function ListenersPage() {
	await requireSession()
	const listeners = await listListenerSummaries()
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-xl font-semibold">Listeners</h1>
				<Link href="/admin/listeners/new" className="btn btn-primary">
					Add listener
				</Link>
			</div>
			{listeners.length === 0 && <p className="muted">No listeners yet.</p>}
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Time zone</th>
							<th>Deps</th>
							<th>Active</th>
							<th>Episodes</th>
							<th>Last episode</th>
							<th>Last feed fetch</th>
						</tr>
					</thead>
					<tbody>
						{listeners.map((listener) => (
							<tr key={listener.id} className={listener.active ? undefined : 'muted'}>
								<td>
									<Link href={`/admin/listeners/${listener.id}`} className="underline">
										{listener.name}
									</Link>
								</td>
								<td className="whitespace-nowrap">{listener.timezone}</td>
								<td>{listener.stack.length}</td>
								<td>{listener.active ? 'yes' : 'no'}</td>
								<td>{listener.episode_count}</td>
								<td className="whitespace-nowrap">{listener.last_episode ?? 'none'}</td>
								<td className="whitespace-nowrap">{formatInstant(listener.last_fetched_at)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
