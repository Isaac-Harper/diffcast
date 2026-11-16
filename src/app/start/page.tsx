import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { COMMON_TIME_ZONES } from '@/lib/time'
import { StartForm } from './start-form'

export const metadata: Metadata = {
	title: 'Start your Diffcast',
	description: 'Subscribe to Diffcast: a private daily tech and AI podcast for $25 a month.',
	alternates: { canonical: '/start' },
}

async function CanceledNote({
	searchParams,
}: {
	searchParams: PageProps<'/start'>['searchParams']
}) {
	const { canceled } = await searchParams
	if (canceled !== '1') return null
	return (
		<p role="status" className="card mt-6 border-warn-line bg-warn-soft text-sm">
			Checkout was canceled and nothing was charged. Fill in the form again whenever you are ready.
		</p>
	)
}

export default function StartPage({ searchParams }: PageProps<'/start'>) {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
				<p className="font-mono text-sm text-muted">Standard · $25 a month</p>
				<h1 className="mt-3 text-title font-semibold text-balance">Start your Diffcast</h1>
				<p className="mt-4 text-lg leading-8 text-pretty text-muted">
					Tell us where you are and what you care about. Payment is on the next page, and your
					private feed link is ready right after.
				</p>
				<Suspense>
					<CanceledNote searchParams={searchParams} />
				</Suspense>
				<div className="mt-10 rounded-card border border-line bg-surface p-6 sm:p-8">
					<StartForm timeZones={COMMON_TIME_ZONES} />
				</div>
			</main>
			<SiteFooter />
		</>
	)
}
