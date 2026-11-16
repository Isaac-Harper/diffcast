import type { Metadata } from 'next'
import { formatPercent, formatUsd } from '@/lib/format'
import { gateReport, gateWindow } from '@/lib/gate'
import { gateListeners, gateVerdicts } from '@/lib/store/gate'

export const metadata: Metadata = { title: 'Gate' }

function Line({ label, value, met }: { label: string; value: string; met: boolean }) {
	return (
		<div className="card space-y-1">
			<p className="muted text-sm">{label}</p>
			<p className="text-lg font-semibold tabular-nums">{value}</p>
			<p className={met ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
				{met ? 'Met' : 'Not met'}
			</p>
		</div>
	)
}

export default async function GatePage() {
	const window = gateWindow()
	if (!window) {
		return (
			<p className="card muted text-sm">
				Set DIFFCAST_GATE_START (YYYY-MM-DD) and optionally DIFFCAST_GATE_DAYS to see the Phase 0
				gate.
			</p>
		)
	}
	const [listeners, verdicts] = await Promise.all([
		gateListeners(window.dates),
		gateVerdicts(window.dates),
	])
	const today = new Date().toISOString().slice(0, 10)
	const report = gateReport(listeners, verdicts, window, today)

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-xl font-semibold">Phase 0 gate</h1>
				<p className="muted text-sm tabular-nums">
					{window.days} weekdays from {window.start} to {window.dates.at(-1)}
				</p>
			</header>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Line
					label={`Listeners playing ${report.listen.episodes}+ episodes (need ${report.listen.needed})`}
					value={`${report.listen.count} of ${report.listeners.length}`}
					met={report.listen.met}
				/>
				<Line
					label={`Would pay $15 (need ${report.pay.needed})`}
					value={String(report.pay.count)}
					met={report.pay.met}
				/>
				<Line
					label={`3+ stories on ${report.stories.days} of ${window.days} days`}
					value={`${report.stories.count} of ${report.stories.of} listeners`}
					met={report.stories.met}
				/>
				<Line
					label="Errors in spot checks (at most 1 in 20)"
					value={`${report.errors.errors} of ${report.errors.checked}`}
					met={report.errors.met}
				/>
			</div>

			<dl className="grid grid-cols-3 gap-3 text-sm">
				<div className="card">
					<dt className="muted">Average cost</dt>
					<dd className="font-semibold tabular-nums">{formatUsd(report.cost.average)}</dd>
				</div>
				<div className="card">
					<dt className="muted">Max cost</dt>
					<dd className="font-semibold tabular-nums">{formatUsd(report.cost.max)}</dd>
				</div>
				<div className="card">
					<dt className="muted">On time (before 06:00)</dt>
					<dd className="font-semibold tabular-nums">{formatPercent(report.onTime)}</dd>
				</div>
			</dl>

			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							<th>Listener</th>
							<th>Delivered</th>
							<th>Downloaded</th>
							<th>Listened</th>
							<th>3+ story days</th>
							<th>Would pay</th>
						</tr>
					</thead>
					<tbody>
						{report.listeners.map((row) => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td>
									{row.delivered} of {row.expected}
								</td>
								<td>{row.downloaded}</td>
								<td className={row.meetsListen ? 'text-green-700' : undefined}>{row.listened}</td>
								<td className={row.meetsStories ? 'text-green-700' : undefined}>{row.storyDays}</td>
								<td>{row.wouldPay ?? 'no answer'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
