import { connection } from 'next/server'
import { describeNextEpisode, nextEpisode } from '@/lib/next-episode'
import { isServed } from '@/lib/served'
import type { Billing } from '@/lib/served'

export interface ScheduledListener extends Billing {
	timezone: string
	days: number[]
}

export async function NextEpisode({
	listener,
	latestEpisodeDate,
	label,
}: {
	listener: ScheduledListener
	latestEpisodeDate: string | null
	label: string
}) {
	if (!isServed(listener)) {
		return (
			<p className="text-sm text-del">
				New episodes are paused until your plan is active. Your topics, stack and past episodes are
				kept.
			</p>
		)
	}
	await connection()
	const now = new Date()
	const next = nextEpisode(now, listener.timezone, listener.days, latestEpisodeDate)
	return (
		<p className="space-y-1">
			<span className="block font-mono text-xs text-muted">{label}</span>
			<span className="block text-lg font-semibold text-balance">
				{describeNextEpisode(now, next, listener.timezone)}
			</span>
		</p>
	)
}

export function TopicChips({ topics }: { topics: readonly string[] }) {
	if (topics.length === 0) {
		return (
			<p className="text-muted">
				Every topic is paused, so episodes cover general tech and AI news for developers.
			</p>
		)
	}
	return (
		<>
			<p className="text-muted">It covers</p>
			<ul className="flex flex-wrap gap-2">
				{topics.map((topic) => (
					<li
						key={topic}
						className="rounded-control border border-line bg-sunken px-2.5 py-1 font-mono text-xs"
					>
						{topic}
					</li>
				))}
			</ul>
		</>
	)
}
