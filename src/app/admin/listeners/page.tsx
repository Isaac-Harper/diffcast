import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@ui-sdk/react/button'
import { formatInstant } from '@/lib/format'
import { listListenerSummaries } from '@/lib/store/listeners'
import { requireSession } from '@/lib/auth'
import { scheduleLabel } from '@/lib/schedule'
import { PLAN_LABELS, planOf } from '@/lib/served'

export const metadata: Metadata = { title: 'Listeners' }

export default async function ListenersPage() {
	await requireSession()
	const listeners = await listListenerSummaries()
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-xl font-semibold">Listeners</h1>
				<Button data-variant="solid" render={<Link href="/admin/listeners/new" />}>
					Add listener
				</Button>
			</div>
			{listeners.length === 0 && (
				<p className="text-muted">
					No listeners yet. Add the first one to start generating episodes.
				</p>
			)}
			{listeners.length > 0 && (
				<div className="table-frame">
					<table className="data-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Time zone</th>
								<th>Schedule</th>
								<th>Deps</th>
								<th>Active</th>
								<th>Plan</th>
								<th>Episodes</th>
								<th>Last episode</th>
								<th>Last feed fetch</th>
							</tr>
						</thead>
						<tbody>
							{listeners.map((listener) => (
								<tr key={listener.id} className={listener.active ? undefined : 'text-muted'}>
									<td>
										<Link href={`/admin/listeners/${listener.id}`} className="underline">
											{listener.name}
										</Link>
									</td>
									<td className="font-mono text-xs whitespace-nowrap">{listener.timezone}</td>
									<td className="whitespace-nowrap">{scheduleLabel(listener.days)}</td>
									<td>{listener.stack.length}</td>
									<td>{listener.active ? 'yes' : 'no'}</td>
									<td className="whitespace-nowrap">{PLAN_LABELS[planOf(listener)]}</td>
									<td>{listener.episode_count}</td>
									<td className="whitespace-nowrap">{listener.last_episode ?? 'none'}</td>
									<td className="whitespace-nowrap">{formatInstant(listener.last_fetched_at)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
