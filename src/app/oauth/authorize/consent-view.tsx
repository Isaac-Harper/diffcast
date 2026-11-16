import { SubmitButton } from '@/app/components/submit-button'
import { Wordmark } from '@/app/components/wordmark'
import type { AuthorizeRequest } from '@/lib/oauth/authorize-request'
import { isClientIdUrl } from '@/lib/oauth/client-metadata'
import { isLoopbackRedirect, redirectHost } from '@/lib/oauth/redirect-uris'

const ABILITIES = [
	'Read and change your interests, takes and notes',
	'Read and change the days you get episodes',
	'Save what you are working on (project, packages, topics) for 30 days',
	'Read your recent episodes and their sources',
] as const

export function ConsentView({
	request,
	email,
	query,
	decide,
}: {
	request: AuthorizeRequest
	email: string | null
	query: string
	decide: (form: FormData) => Promise<void>
}) {
	const loopback = isLoopbackRedirect(request.redirectUri)
	const host = redirectHost(request.redirectUri)
	const verifiedDomain = isClientIdUrl(request.clientId) ? new URL(request.clientId).host : null
	return (
		<div className="space-y-6">
			<Wordmark className="text-sm" />
			<div className="space-y-3">
				<h1 className="text-title font-semibold text-balance">Connect {request.clientName}?</h1>
				<p className="text-lg leading-8 text-pretty text-muted">
					{request.clientName} wants to read and update your Diffcast interests, schedule and work
					context, and read your episodes.
				</p>
			</div>
			<ul className="card space-y-2">
				{ABILITIES.map((ability) => (
					<li key={ability} className="flex gap-3 text-pretty">
						<span aria-hidden="true" className="w-4 shrink-0 font-mono text-add">
							+
						</span>
						{ability}
					</li>
				))}
				<li className="flex gap-3 text-pretty text-muted">
					<span aria-hidden="true" className="w-4 shrink-0 font-mono text-del">
						-
					</span>
					It cannot see billing, your feed link or your email.
				</li>
			</ul>
			<dl className="space-y-2 text-sm">
				<div className="flex flex-wrap gap-x-2">
					<dt className="text-muted">Signed in as</dt>
					<dd>{email ?? 'your Diffcast account'}</dd>
				</div>
				<div className="flex flex-wrap gap-x-2">
					<dt className="text-muted">After you choose, you go back to</dt>
					<dd className="font-mono">{host}</dd>
				</div>
				{verifiedDomain && (
					<div className="flex flex-wrap gap-x-2">
						<dt className="text-muted">Agent identity published by</dt>
						<dd className="font-mono">{verifiedDomain}</dd>
					</div>
				)}
			</dl>
			{loopback && (
				<p role="note" className="card border-warn-line bg-warn-soft text-sm text-pretty">
					This agent runs on your own computer. Any program on it could ask in its name, so only
					allow this if you just started connecting an agent yourself.
				</p>
			)}
			<form action={decide} className="flex flex-wrap items-center gap-3">
				<input type="hidden" name="query" value={query} />
				<SubmitButton variant="solid" size="lg" name="decision" value="allow">
					Allow
				</SubmitButton>
				<SubmitButton size="lg" name="decision" value="deny">
					Deny
				</SubmitButton>
			</form>
			<p className="text-sm text-muted">You can disconnect it any time from your account.</p>
		</div>
	)
}
