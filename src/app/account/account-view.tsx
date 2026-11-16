import Link from 'next/link'
import { AgentSetup } from '@/app/components/agent-setup'
import { DaysForm, InterestsForm } from '@/app/components/listener-settings'
import { SubmitButton } from '@/app/components/submit-button'
import { formatInstant } from '@/lib/format'
import { isServed, PLAN_LABELS, planOf } from '@/lib/served'
import { stackToLines } from '@/lib/stack-parser'
import type { StoredInterest } from '@/lib/store/interests'
import type { Listener } from '@/lib/store/listeners'
import type { GrantRow } from '@/lib/store/oauth'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { signOut } from '../signin/actions'
import {
	disconnectAgent,
	openBillingPortal,
	saveAccountDays,
	saveAccountInterests,
	signOutEverywhere,
} from './actions'
import { NewFeedLink, ProfileForm } from './forms'

function planLine(listener: Listener): string {
	const plan = planOf(listener)
	if (plan === 'comped') return 'Comped: episodes are on the house.'
	if (plan === 'none') return 'No subscription.'
	const label = `Standard, $25 a month · ${PLAN_LABELS[plan]}`
	if (!listener.current_period_end) return label
	const verb = plan === 'canceled' ? 'Ended' : 'Current period ends'
	return `${label} · ${verb} ${formatInstant(listener.current_period_end)}`
}

export function AccountView({
	listener,
	interests,
	grants,
	origin,
}: {
	listener: Listener
	interests: readonly StoredInterest[]
	grants: readonly GrantRow[]
	origin: string
}) {
	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<h1 className="text-title font-semibold text-balance">Your Diffcast</h1>
				<p className="text-muted">{listener.email}</p>
			</header>

			<section className="card space-y-3" aria-labelledby="plan-heading">
				<h2 id="plan-heading" className="text-lg font-semibold">
					Plan
				</h2>
				<p className="text-sm">{planLine(listener)}</p>
				{!isServed(listener) && (
					<p className="text-sm text-del">New episodes are paused until the plan is active.</p>
				)}
				{listener.stripe_customer_id && (
					<form action={openBillingPortal}>
						<SubmitButton>Manage billing</SubmitButton>
					</form>
				)}
			</section>

			<section className="card space-y-3" aria-labelledby="interests-heading">
				<h2 id="interests-heading" className="text-lg font-semibold">
					What your episodes cover
				</h2>
				<InterestsForm action={saveAccountInterests} interests={interests} />
			</section>

			<section className="card space-y-3" aria-labelledby="days-heading">
				<h2 id="days-heading" className="text-lg font-semibold">
					When episodes arrive
				</h2>
				<DaysForm action={saveAccountDays} days={listener.days} />
			</section>

			<section className="card space-y-3" aria-labelledby="profile-heading">
				<h2 id="profile-heading" className="text-lg font-semibold">
					You and your stack
				</h2>
				<ProfileForm
					timezone={listener.timezone}
					focus={listener.focus}
					stackLines={stackToLines(listener.stack)}
					timeZones={COMMON_TIME_ZONES}
				/>
			</section>

			<section className="card space-y-3" aria-labelledby="agents-heading">
				<h2 id="agents-heading" className="text-lg font-semibold">
					Connected agents
				</h2>
				{grants.length === 0 ? (
					<p className="text-sm text-muted">No agent is connected.</p>
				) : (
					<ul className="divide-y divide-line">
						{grants.map((grant) => (
							<li
								key={grant.id}
								className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0"
							>
								<div className="min-w-0 flex-1">
									<p className="font-medium">{grant.clientName}</p>
									<p className="text-sm text-muted">
										Connected {formatInstant(grant.createdAt)} · last used{' '}
										{formatInstant(grant.lastUsedAt)}
									</p>
								</div>
								<form action={disconnectAgent}>
									<input type="hidden" name="grantId" value={grant.id} />
									<SubmitButton variant="destructive">
										Disconnect<span className="sr-only"> {grant.clientName}</span>
									</SubmitButton>
								</form>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="card space-y-3" aria-labelledby="connect-heading">
				<h2 id="connect-heading" className="text-lg font-semibold">
					Connect your agent
				</h2>
				<p className="text-sm text-pretty text-muted">
					Your coding agent can tell Diffcast what you are working on, and change your interests and
					days for you. Add this server to it and sign in once.{' '}
					<Link href="/agents" className="text-fg">
						What it can do
					</Link>
				</p>
				<AgentSetup origin={origin} />
			</section>

			<section className="card space-y-3" aria-labelledby="feed-heading">
				<h2 id="feed-heading" className="text-lg font-semibold">
					Feed link
				</h2>
				<p className="text-sm text-pretty text-muted">
					Lost your feed link, or shared it by mistake? Get a new one. Revoking the old links stops
					them working in every app that uses them, and signs out every other browser.
				</p>
				<NewFeedLink />
			</section>

			<section className="card space-y-3" aria-labelledby="sessions-heading">
				<h2 id="sessions-heading" className="text-lg font-semibold">
					Sign in
				</h2>
				<p className="text-sm text-pretty text-muted">
					Signed in somewhere you should not be? Sign out everywhere ends every browser session,
					this one included. Connected agents stay connected; disconnect them above.
				</p>
				<div className="flex flex-wrap gap-3">
					<form action={signOutEverywhere}>
						<SubmitButton variant="destructive">Sign out everywhere</SubmitButton>
					</form>
					<form action={signOut}>
						<SubmitButton variant="quiet">Sign out</SubmitButton>
					</form>
				</div>
			</section>
		</div>
	)
}
