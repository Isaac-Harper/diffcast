import { formatPercent, formatUsd } from '@/lib/format'
import { LISTEN_SHARE, STORY_SHARE } from '@/lib/gate'
import type { GateReport } from '@/lib/gate'
import { scheduleLabel } from '@/lib/schedule'

function Line({ label, value, met }: { label: string; value: string; met: boolean }) {
	return (
		<div className="card space-y-1">
			<p className="font-mono text-xs text-muted">{label}</p>
			<p className="text-2xl font-semibold tabular-nums">{value}</p>
			<p className={met ? 'text-sm text-add' : 'text-sm text-del'}>{met ? 'Met' : 'Not met'}</p>
		</div>
	)
}

export function GateView({ report }: { report: GateReport }) {
	const window = report.window
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-xl font-semibold">Phase 0 gate</h1>
				<p className="font-mono text-xs text-muted tabular-nums">
					{window.days} days from {window.start} to {window.dates.at(-1)}, counting each
					listener&apos;s scheduled days
				</p>
			</header>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Line
					label={`Listeners playing ${formatPercent(LISTEN_SHARE)} of their episodes (need ${report.listen.needed})`}
					value={`${report.listen.count} of ${report.listeners.length}`}
					met={report.listen.met}
				/>
				<Line
					label={`Would pay $25 (need ${report.pay.needed})`}
					value={String(report.pay.count)}
					met={report.pay.met}
				/>
				<Line
					label={`3+ stories on ${formatPercent(STORY_SHARE)} of their weekday episodes`}
					value={`${report.stories.count} of ${report.stories.of} listeners`}
					met={report.stories.met}
				/>
				<Line
					label="Errors in spot checks (at most 1 in 20)"
					value={`${report.errors.errors} of ${report.errors.checked}`}
					met={report.errors.met}
				/>
			</div>

			<dl className="grid gap-3 sm:grid-cols-3">
				<div className="card">
					<dt className="font-mono text-xs text-muted">Average cost</dt>
					<dd className="text-lg font-semibold tabular-nums">{formatUsd(report.cost.average)}</dd>
				</div>
				<div className="card">
					<dt className="font-mono text-xs text-muted">Max cost</dt>
					<dd className="text-lg font-semibold tabular-nums">{formatUsd(report.cost.max)}</dd>
				</div>
				<div className="card">
					<dt className="font-mono text-xs text-muted">On time (before 06:00)</dt>
					<dd className="text-lg font-semibold tabular-nums">{formatPercent(report.onTime)}</dd>
				</div>
			</dl>

			<div className="table-frame">
				<table className="data-table">
					<thead>
						<tr>
							<th>Listener</th>
							<th>Schedule</th>
							<th>Delivered</th>
							<th>Downloaded</th>
							<th>Listened (needed)</th>
							<th>3+ story weekdays (needed)</th>
							<th>Would pay</th>
						</tr>
					</thead>
					<tbody>
						{report.listeners.map((row) => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td>{scheduleLabel(row.days)}</td>
								<td>
									{row.delivered} of {row.expected}
								</td>
								<td>{row.downloaded}</td>
								<td className={row.meetsListen ? 'text-add' : undefined}>
									{row.listened} of {row.listenNeeded}
								</td>
								<td className={row.meetsStories ? 'text-add' : undefined}>
									{row.storyDays} of {row.storyNeeded}
								</td>
								<td>{row.wouldPay ?? 'no answer'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
