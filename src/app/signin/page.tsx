import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteFooter, SiteHeader } from '@/app/components/site-chrome'
import { SignInForm } from './signin-form'

export const metadata: Metadata = {
	title: 'Sign in',
	robots: { index: false, follow: false },
}

async function Notice({ searchParams }: { searchParams: PageProps<'/signin'>['searchParams'] }) {
	const query = await searchParams
	if (query['error'] === 'expired') {
		return (
			<p role="alert" className="card mb-6 border-warn-line bg-warn-soft text-sm">
				That sign in link has expired or was already used. Ask for a new one below.
			</p>
		)
	}
	if (query['signed_out'] === '1') {
		return (
			<p role="status" className="mb-6 text-sm text-muted">
				Signed out.
			</p>
		)
	}
	return null
}

export default function SignInPage({ searchParams }: PageProps<'/signin'>) {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-md px-5 py-14 sm:px-8 sm:py-20">
				<h1 className="text-title font-semibold text-balance">Sign in</h1>
				<p className="mt-3 mb-8 text-pretty text-muted">
					Enter the email you subscribed with and we will send a one time link. No password.
				</p>
				<Suspense>
					<Notice searchParams={searchParams} />
				</Suspense>
				<div className="rounded-card border border-line bg-surface p-6">
					<SignInForm />
				</div>
				<p className="mt-6 text-sm text-muted">
					Not subscribed yet?{' '}
					<Link href="/start" className="font-medium text-fg">
						Start for $25 a month
					</Link>
				</p>
			</main>
			<SiteFooter />
		</>
	)
}
