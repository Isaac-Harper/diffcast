import type { Metadata } from 'next'
import { formatInstant } from '@/lib/format'
import { listJobRuns } from '@/lib/store/runs'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Runs' }

export default async function RunsPage() {
	await requireSession()
	const runs = await listJobRuns(50)
	return (
		<div className="space-y-4">
			<h1 className="text-xl font-semibold">Job runs</h1>
			{runs.length === 0 && <p className="muted">No runs yet.</p>}
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							<th>At</th>
							<th>Listener</th>
							<th>Date</th>
							<th>Status</th>
							<th>Step</th>
							<th>Message</th>
						</tr>
					</thead>
					<tbody>
						{runs.map((run) => (
							<tr
								key={run.id}
								className={run.status === 'fail' ? 'bg-red-50 dark:bg-red-950/40' : undefined}
							>
								<td className="whitespace-nowrap">{formatInstant(run.at)}</td>
								<td>{run.listener_name}</td>
								<td className="whitespace-nowrap">{run.run_on}</td>
								<td className={run.status === 'fail' ? 'font-medium text-red-600' : undefined}>
									{run.status}
								</td>
								<td>{run.step ?? ''}</td>
								<td className="break-words">{run.message}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
