import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@ui-sdk/react/button'
import { requireSession } from '@/lib/auth'
import { formatInstant } from '@/lib/format'
import { listWaitlist } from '@/lib/store/waitlist'

export const metadata: Metadata = { title: 'Waitlist' }

const STACK_PREVIEW_LENGTH = 80

export default async function WaitlistPage() {
	await requireSession()
	const entries = await listWaitlist()
	return (
		<div className="space-y-4">
			<h1 className="text-xl font-semibold">Waitlist</h1>
			{entries.length === 0 && (
				<p className="text-muted">
					No one on the waitlist yet. Sign-ups from the landing page appear here.
				</p>
			)}
			{entries.length > 0 && (
				<div className="table-frame">
					<table className="data-table">
						<thead>
							<tr>
								<th>Email</th>
								<th>Wants to hear about</th>
								<th>Podcast app</th>
								<th>Stack</th>
								<th>Joined</th>
								<th>Invited</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => (
								<tr key={entry.id}>
									<td className="whitespace-nowrap">{entry.email}</td>
									<td className="max-w-72 text-pretty">{entry.interests_text || 'not said'}</td>
									<td>{entry.podcast_app ?? 'none'}</td>
									<td className="max-w-48 truncate font-mono text-xs">
										{entry.stack_text ? entry.stack_text.slice(0, STACK_PREVIEW_LENGTH) : 'none'}
									</td>
									<td className="whitespace-nowrap">{formatInstant(entry.created_at)}</td>
									<td className="whitespace-nowrap">
										{entry.invited_at ? (
											formatInstant(entry.invited_at)
										) : (
											<Button render={<Link href={`/admin/listeners/new?waitlist=${entry.id}`} />}>
												Invite<span className="sr-only"> {entry.email}</span>
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
