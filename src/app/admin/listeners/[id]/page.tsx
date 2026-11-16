import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConfirmAction } from '@/app/components/confirm-action'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { customerDashboardUrl } from '@/lib/billing/stripe'
import { formatInstant } from '@/lib/format'
import { PLAN_LABELS, planOf } from '@/lib/served'
import { wholeId } from '@/lib/forms'
import { stackToLines } from '@/lib/stack-parser'
import { listFeedTokens } from '@/lib/store/feed-tokens'
import { listInterests } from '@/lib/store/interests'
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
	const [tokens, interests, query] = await Promise.all([
		listFeedTokens(listener.id),
		listInterests(listener.id),
		searchParams,
	])

	return (
		<div className="max-w-3xl space-y-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold">{listener.name}</h1>
					<p className="text-sm text-muted">
						{listener.active ? 'Active' : 'Inactive'} · {PLAN_LABELS[planOf(listener)]}
						{listener.current_period_end &&
							` until ${formatInstant(listener.current_period_end)}`}{' '}
						·{' '}
						<Link href={`/admin/episodes?listener=${listener.id}`} className="underline">
							Episodes
						</Link>
						{listener.stripe_customer_id && (
							<>
								{' '}
								·{' '}
								<a
									href={customerDashboardUrl(
										listener.stripe_customer_id,
										process.env['STRIPE_SECRET_KEY'] ?? ''
									)}
									className="underline"
									target="_blank"
									rel="noreferrer"
								>
									Stripe customer
								</a>
							</>
						)}
					</p>
				</div>
				{listener.active ? (
					<ConfirmAction
						action={toggleListener}
						fields={{ id: String(listener.id), active: 'false' }}
						trigger="Deactivate"
						title={`Deactivate ${listener.name}?`}
						description="The generator stops making episodes for this listener and their feed stops working until reactivated."
						confirmLabel="Stop their episodes"
						doneMessage="Listener deactivated."
						destructive
					/>
				) : (
					<form action={toggleListener}>
						<input type="hidden" name="id" value={listener.id} />
						<input type="hidden" name="active" value="true" />
						<SubmitButton>Reactivate</SubmitButton>
					</form>
				)}
			</header>

			{query['saved'] && <FormStatus status="saved" message="Saved." />}

			<ListenerForm
				key={JSON.stringify([
					listener,
					interests.map((interest) => [
						interest.topic,
						interest.take,
						interest.note,
						interest.active,
					]),
				])}
				listener={listener}
				interests={interests}
				stackLines={stackToLines(listener.stack)}
				timeZones={COMMON_TIME_ZONES}
			/>

			<section className="space-y-4" aria-labelledby="tokens-heading">
				<h2 id="tokens-heading" className="text-lg font-semibold">
					Feed tokens
				</h2>
				<IssueToken listenerId={listener.id} />
				{tokens.length > 0 && (
					<div className="table-frame">
						<table className="data-table">
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
									<tr key={token.id} className={token.revoked_at ? 'text-muted' : undefined}>
										<td>{token.label}</td>
										<td className="whitespace-nowrap">{formatInstant(token.created_at)}</td>
										<td className="whitespace-nowrap">{formatInstant(token.last_fetched_at)}</td>
										<td>{token.fetch_count}</td>
										<td className="max-w-40 truncate font-mono text-xs">
											{token.last_user_agent ?? ''}
										</td>
										<td>
											{token.revoked_at ? (
												'revoked'
											) : (
												<ConfirmAction
													action={revokeToken}
													fields={{ tokenId: String(token.id) }}
													trigger="Revoke"
													triggerDetail={token.label}
													title={`Revoke the ${token.label} token?`}
													description="Podcast apps using this link stop getting episodes and it cannot be undone."
													confirmLabel="Cut off this link"
													doneMessage="Token revoked."
													destructive
												/>
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
