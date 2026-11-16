'use client'

import { useActionState } from 'react'
import { FeedLinks } from '@/app/components/feed-links'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { revealWelcomeLinks } from './actions'
import type { WelcomeResult } from './actions'

export function WelcomeLinks({ sessionId }: { sessionId: string }) {
	const [result, action] = useActionState<WelcomeResult, FormData>(revealWelcomeLinks, {
		status: 'idle',
	})
	if (result.status === 'issued') {
		return <FeedLinks feedUrl={result.feedUrl} pageUrl={result.pageUrl} />
	}
	return (
		<form action={action} className="space-y-3">
			<input type="hidden" name="sessionId" value={sessionId} />
			<SubmitButton variant="solid" size="lg">
				Show my feed link
			</SubmitButton>
			{result.status === 'error' && <FormStatus status="error" message={result.message} />}
			<p className="text-sm text-muted">
				The link is shown once on this page. The same details are in your welcome email.
			</p>
		</form>
	)
}
