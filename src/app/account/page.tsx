import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { requireListener } from '@/lib/listener-auth'
import { listInterests } from '@/lib/store/interests'
import { getListener } from '@/lib/store/listeners'
import { AccountView } from './account-view'

export const metadata: Metadata = {
	title: 'Your account',
	robots: { index: false, follow: false },
}

async function Account() {
	const listenerId = await requireListener()
	const [listener, interests] = await Promise.all([
		getListener(listenerId),
		listInterests(listenerId),
	])
	if (!listener) redirect('/signin')
	return <AccountView listener={listener} interests={interests} />
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
		</>
	)
}
