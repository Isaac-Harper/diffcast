import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { welcomeState } from '@/lib/billing/welcome'
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
	if (state.kind === 'shown') {
		return (
			<p className="card mt-8 text-pretty">
				Your feed link was already shown on this page. It is also in your welcome email, and you can
				get a new one any time from{' '}
				<Link href="/signin" className="font-medium">
					your account
				</Link>
				.
			</p>
		)
	}
	return (
		<div className="mt-8 space-y-6">
			<p className="text-lg leading-8 text-pretty text-muted">
				Your subscription is active. Your first episode lands early on the next morning you picked.
				Add your private feed to a podcast app now.
			</p>
			<WelcomeLinks sessionId={sessionId} />
		</div>
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
