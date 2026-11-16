import type { Metadata } from 'next'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { ListenerForm } from '../listener-form'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Add listener' }

export default async function NewListenerPage() {
	await requireSession()
	return (
		<div className="max-w-2xl space-y-4">
			<h1 className="text-xl font-semibold">Add listener</h1>
			<ListenerForm listener={null} stackLines="" timeZones={COMMON_TIME_ZONES} />
		</div>
	)
}
