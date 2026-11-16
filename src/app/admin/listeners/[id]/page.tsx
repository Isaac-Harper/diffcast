import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SubmitButton } from '@/app/components/submit-button'
import { formatInstant } from '@/lib/format'
import { wholeId } from '@/lib/forms'
import { stackToLines } from '@/lib/stack-parser'
import { listFeedTokens } from '@/lib/store/feed-tokens'
import { getListener } from '@/lib/store/listeners'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { revokeToken, toggleListener } from '../actions'
import { IssueToken } from '../issue-token'
import { ListenerForm } from '../listener-form'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Listener' }

export default async function ListenerPage({
	params,
	searchParams,
}: PageProps<'/admin/listeners/[id]'>) {
	await requireSession()
	const id = wholeId((await params).id)
	const listener = id === null ? null : await getListener(id)
	if (!listener) notFound()
	const [tokens, query] = await Promise.all([listFeedTokens(listener.id), searchParams])

	return (
		<div className="max-w-2xl space-y-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold">{listener.name}</h1>
					<p className="muted text-sm">
						{listener.active ? 'Active' : 'Inactive'} ·{' '}
						<Link href={`/admin/episodes?listener=${listener.id}`} className="underline">
							Episodes
						</Link>
					</p>
				</div>
				<form action={toggleListener}>
					<input type="hidden" name="id" value={listener.id} />
					<input type="hidden" name="active" value={listener.active ? 'false' : 'true'} />
					<SubmitButton>{listener.active ? 'Deactivate' : 'Reactivate'}</SubmitButton>
				</form>
			</header>

			{query['saved'] && (
				<p role="status" className="text-sm text-green-700">
					Saved.
				</p>
			)}

			<ListenerForm
				key={JSON.stringify(listener)}
				listener={listener}
				stackLines={stackToLines(listener.stack)}
				timeZones={COMMON_TIME_ZONES}
			/>

			<section className="space-y-4" aria-labelledby="tokens-heading">
				<h2 id="tokens-heading" className="text-lg font-semibold">
					Feed tokens
				</h2>
				<IssueToken listenerId={listener.id} />
				{tokens.length > 0 && (
					<div className="overflow-x-auto">
						<table className="table">
							<thead>
								<tr>
									<th>Label</th>
									<th>Created</th>
									<th>Last fetch</th>
									<th>Fetches</th>
									<th>Client</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{tokens.map((token) => (
									<tr key={token.id} className={token.revoked_at ? 'muted' : undefined}>
										<td>{token.label}</td>
										<td className="whitespace-nowrap">{formatInstant(token.created_at)}</td>
										<td className="whitespace-nowrap">{formatInstant(token.last_fetched_at)}</td>
										<td>{token.fetch_count}</td>
										<td className="max-w-48 truncate">{token.last_user_agent ?? ''}</td>
										<td>
											{token.revoked_at ? (
												'revoked'
											) : (
												<form action={revokeToken}>
													<input type="hidden" name="tokenId" value={token.id} />
													<SubmitButton>Revoke</SubmitButton>
												</form>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	)
}
