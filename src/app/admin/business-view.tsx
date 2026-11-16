import { formatUsd } from '@/lib/format'
import type { BusinessReport } from '@/lib/business'

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="card space-y-1">
			<p className="font-mono text-xs text-muted">{label}</p>
			<p className="text-2xl font-semibold tabular-nums">{value}</p>
			{detail && <p className="text-sm text-muted">{detail}</p>}
		</div>
	)
}

export function BusinessView({ report }: { report: BusinessReport }) {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-xl font-semibold">Business</h1>
				<p className="font-mono text-xs text-muted">
					Days and weeks in UTC. Revenue is paying listeners at $25, before Stripe fees.
				</p>
			</header>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Stat
					label="Served listeners"
					value={String(report.served)}
					detail={`${report.paying} paying, ${report.comped} comped`}
				/>
				<Stat label="MRR" value={`$${report.mrr}`} />
				<Stat
					label="Signups this week"
					value={`${report.signupsCompleted} of ${report.signupsStarted}`}
					detail="completed of started"
				/>
				<Stat
					label="Episodes today"
					value={String(report.episodesToday)}
					detail={`${report.failuresToday} failed ${report.failuresToday === 1 ? 'run' : 'runs'}`}
				/>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Stat label="Average episode cost, 7 days" value={formatUsd(report.averageCost7)} />
				<Stat label="Max episode cost, 7 days" value={formatUsd(report.maxCost7)} />
				<Stat label="Revenue, 30 days" value={formatUsd(report.revenue30)} />
				<Stat
					label="Episode cost, 30 days"
					value={formatUsd(report.episodeCost30)}
					detail={`Margin ${formatUsd(report.margin30)}`}
				/>
			</div>
		</div>
	)
}
