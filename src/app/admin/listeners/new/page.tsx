import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { wholeId } from '@/lib/forms'
import { getWaitlistEntry } from '@/lib/store/waitlist'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { waitlistName } from '@/lib/waitlist'
import { ListenerForm } from '../listener-form'

export const metadata: Metadata = { title: 'Add listener' }

export default async function NewListenerPage({ searchParams }: PageProps<'/admin/listeners/new'>) {
	await requireSession()
	const raw = (await searchParams)['waitlist']
	const waitlistId = wholeId(typeof raw === 'string' ? raw : null)
	const entry = waitlistId === null ? null : await getWaitlistEntry(waitlistId)

	return (
		<div className="max-w-2xl space-y-4">
			<h1 className="text-xl font-semibold">Add listener</h1>
			{entry ? (
				<>
					<p className="text-sm text-muted">Inviting {entry.email} from the waitlist</p>
					<ListenerForm
						listener={null}
						stackLines={entry.stack_text}
						timeZones={COMMON_TIME_ZONES}
						waitlistId={entry.id}
						initialName={waitlistName(entry.email)}
						initialEmail={entry.email}
						initialFocus={entry.interests_text}
					/>
				</>
			) : (
				<ListenerForm listener={null} stackLines="" timeZones={COMMON_TIME_ZONES} />
			)}
		</div>
	)
}
