import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { NextEpisode, TopicChips } from '@/app/components/next-episode'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { welcomeState } from '@/lib/billing/welcome'
import { latestEpisodeDate } from '@/lib/store/episodes'
import { activeInterests } from '@/lib/store/interests'
import { getListener } from '@/lib/store/listeners'
import { WelcomeLinks } from './welcome-links'

export const metadata: Metadata = {
	title: 'Welcome',
	robots: { index: false, follow: false },
	referrer: 'no-referrer',
}

async function WelcomeView({
	searchParams,
}: {
	searchParams: PageProps<'/welcome'>['searchParams']
}) {
	const raw = (await searchParams)['session_id']
	const sessionId = typeof raw === 'string' ? raw : ''
	const state = await welcomeState(sessionId)

	if (state.kind === 'invalid') {
		return (
			<p className="mt-6 text-lg text-muted">
				This page needs the link Stripe sent you back with. If you subscribed, check your email or{' '}
				<Link href="/signin" className="font-medium text-fg">
					sign in
				</Link>
				.
			</p>
		)
	}
	if (state.kind === 'pending') {
		return (
			<p role="status" className="card mt-8 text-pretty">
				Finishing up your subscription. Refresh in a moment.
			</p>
		)
	}
	return (
		<div className="mt-8 space-y-6">
			<p className="text-lg leading-8 text-pretty text-muted">Your subscription is active.</p>
			<FirstEpisode listenerId={state.listenerId} />
			{state.kind === 'shown' ? (
				<p className="card text-pretty">
					Your feed link was already shown on this page. It is also in your welcome email, and you
					can get a new one any time from{' '}
					<Link href="/signin" className="font-medium">
						your account
					</Link>
					.
				</p>
			) : (
				<section className="space-y-3" aria-labelledby="feed-heading">
					<h2 id="feed-heading" className="text-lg font-semibold">
						Add your private feed to a podcast app
					</h2>
					<WelcomeLinks sessionId={sessionId} />
				</section>
			)}
		</div>
	)
}

async function FirstEpisode({ listenerId }: { listenerId: number }) {
	const [listener, topics, latest] = await Promise.all([
		getListener(listenerId),
		activeInterests([listenerId]),
		latestEpisodeDate(listenerId),
	])
	if (!listener) throw new Error(`Welcome listener ${listenerId} is missing`)
	const covered = topics.get(listenerId) ?? []
	return (
		<section className="card space-y-4" aria-label="First episode">
			<NextEpisode
				listener={listener}
				latestEpisodeDate={latest}
				label={latest === null ? 'Your first episode' : 'Your next episode'}
			/>
			<div className="space-y-2 text-sm">
				<TopicChips topics={covered.map((interest) => interest.topic)} />
				<p className="text-pretty text-muted">
					{listener.stack.length === 0
						? 'No stack yet. Add one from your account and the show covers releases in your packages.'
						: `Plus a segment on days one of your ${listener.stack.length} packages ships a release.`}{' '}
					Change topics or days on your listener page (the link below) any time before the episode
					is made.
				</p>
			</div>
		</section>
	)
}

export default function WelcomePage({ searchParams }: PageProps<'/welcome'>) {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
				<h1 className="text-title font-semibold text-balance">Welcome to Diffcast</h1>
				<Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
					<WelcomeView searchParams={searchParams} />
				</Suspense>
			</main>
			<SiteFooter />
		</>
	)
}
