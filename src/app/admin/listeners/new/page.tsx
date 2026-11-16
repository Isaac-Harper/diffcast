import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { DEFAULT_INTERESTS } from '@/lib/interests'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { ListenerForm } from '../listener-form'

const STARTING_INTERESTS = DEFAULT_INTERESTS.map((topic) => ({
	topic,
	take: null,
	note: null,
	active: true,
}))

export const metadata: Metadata = { title: 'Add listener' }

export default async function NewListenerPage() {
	await requireSession()
	return (
		<div className="max-w-2xl space-y-4">
			<h1 className="text-xl font-semibold">Add listener</h1>
			<p className="text-sm text-muted">
				Listeners added here are comped: they get episodes without a subscription.
			</p>
			<ListenerForm
				listener={null}
				interests={STARTING_INTERESTS}
				stackLines=""
				timeZones={COMMON_TIME_ZONES}
			/>
		</div>
	)
}
