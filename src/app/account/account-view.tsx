import { DaysForm, InterestsForm } from '@/app/components/listener-settings'
import { SubmitButton } from '@/app/components/submit-button'
import { formatInstant } from '@/lib/format'
import { isServed, PLAN_LABELS, planOf } from '@/lib/served'
import { stackToLines } from '@/lib/stack-parser'
import type { StoredInterest } from '@/lib/store/interests'
import type { Listener } from '@/lib/store/listeners'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { signOut } from '../signin/actions'
import { openBillingPortal, saveAccountDays, saveAccountInterests } from './actions'
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
}: {
	listener: Listener
	interests: readonly StoredInterest[]
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

			<section className="card space-y-3" aria-labelledby="feed-heading">
				<h2 id="feed-heading" className="text-lg font-semibold">
					Feed link
				</h2>
				<p className="text-sm text-pretty text-muted">
					Lost your feed link, or shared it by mistake? Get a new one. Revoking the old links stops
					them working in every app that uses them.
				</p>
				<NewFeedLink />
			</section>

			<form action={signOut}>
				<SubmitButton variant="quiet">Sign out</SubmitButton>
			</form>
		</div>
	)
}
