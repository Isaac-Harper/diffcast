import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { SubmitButton } from '@/app/components/submit-button'
import { confirmSignIn } from '../actions'

export const metadata: Metadata = {
	title: 'Sign in',
	robots: { index: false, follow: false },
	referrer: 'no-referrer',
}

async function ConfirmForm({
	searchParams,
}: {
	searchParams: PageProps<'/signin/confirm'>['searchParams']
}) {
	const raw = (await searchParams)['token']
	return (
		<form action={confirmSignIn} className="mt-8">
			<input type="hidden" name="token" value={typeof raw === 'string' ? raw : ''} />
			<SubmitButton variant="solid" size="lg">
				Sign in to Diffcast
			</SubmitButton>
		</form>
	)
}

export default function ConfirmSignInPage({ searchParams }: PageProps<'/signin/confirm'>) {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-md px-5 py-14 sm:px-8 sm:py-20">
				<h1 className="text-title font-semibold text-balance">Sign in</h1>
				<p className="mt-3 text-pretty text-muted">One click to finish. The link works once.</p>
				<Suspense>
					<ConfirmForm searchParams={searchParams} />
				</Suspense>
			</main>
			<SiteFooter />
		</>
	)
}
