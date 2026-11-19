import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { Toaster } from '@/app/components/toaster'
import { requestOrigin } from '@/lib/http'
import { requireListener } from '@/lib/listener-auth'
import { latestEpisodeDate } from '@/lib/store/episodes'
import { listInterests } from '@/lib/store/interests'
import { listGrants } from '@/lib/store/oauth'
import { getListener } from '@/lib/store/listeners'
import { AccountView } from './account-view'

export const metadata: Metadata = {
	title: 'Your account',
	robots: { index: false, follow: false },
}

async function Account() {
	const listenerId = await requireListener()
	const [listener, interests, grants, latest, headerList] = await Promise.all([
		getListener(listenerId),
		listInterests(listenerId),
		listGrants(listenerId),
		latestEpisodeDate(listenerId),
		headers(),
	])
	if (!listener) redirect('/signin')
	return (
		<AccountView
			listener={listener}
			interests={interests}
			grants={grants}
			latestEpisodeDate={latest}
			origin={requestOrigin(headerList)}
		/>
	)
}

export default function AccountPage() {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
				<Suspense fallback={<p className="text-muted">Loading…</p>}>
					<Account />
				</Suspense>
			</main>
			<SiteFooter />
			<Toaster />
		</>
	)
}
