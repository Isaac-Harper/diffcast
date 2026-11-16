import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Wordmark } from '@/app/components/wordmark'
import { requestOrigin } from '@/lib/http'
import { sessionListenerId } from '@/lib/listener-auth'
import { consentState } from '@/lib/oauth/consent'
import { withQuery } from '@/lib/oauth/redirect-uris'
import { searchParamsFrom } from '@/lib/return-path'
import { decideAuthorization } from './actions'
import { ConsentView } from './consent-view'

export const metadata: Metadata = {
	title: 'Connect an agent',
	robots: { index: false, follow: false },
	referrer: 'no-referrer',
}

function Problem({ message }: { message: string }) {
	return (
		<div className="space-y-4">
			<Wordmark className="text-sm" />
			<h1 className="text-title font-semibold text-balance">This connection cannot continue</h1>
			<p className="text-pretty text-muted">{message}</p>
			<p>
				<Link href="/agents" className="font-medium">
					How connecting an agent works
				</Link>
			</p>
		</div>
	)
}

async function Consent({
	searchParams,
}: {
	searchParams: PageProps<'/oauth/authorize'>['searchParams']
}) {
	const params = searchParamsFrom(await searchParams)
	const origin = requestOrigin(await headers())
	const state = await consentState(params, origin, await sessionListenerId())
	if (state.kind === 'show_error') return <Problem message={state.message} />
	if (state.kind === 'redirect_error') {
		redirect(
			withQuery(state.redirectUri, {
				error: state.error,
				error_description: state.description,
				state: state.state,
				iss: origin,
			})
		)
	}
	if (state.kind === 'needs_session') {
		redirect(`/oauth/continue?next=${encodeURIComponent(`/oauth/authorize?${params.toString()}`)}`)
	}
	if (state.kind === 'not_served') {
		return (
			<Problem message="Your Diffcast subscription is not active, so no agent can connect to it. Start or renew it from your account first." />
		)
	}
	return (
		<ConsentView
			request={state.request}
			email={state.listener.email}
			query={params.toString()}
			decide={decideAuthorization}
		/>
	)
}

export default function AuthorizePage({ searchParams }: PageProps<'/oauth/authorize'>) {
	return (
		<main className="mx-auto w-full max-w-xl px-5 py-14 sm:px-8 sm:py-20">
			<Suspense fallback={<p className="text-muted">Loading…</p>}>
				<Consent searchParams={searchParams} />
			</Suspense>
		</main>
	)
}
