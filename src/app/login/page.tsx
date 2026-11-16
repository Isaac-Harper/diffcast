import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import {
	PasswordInput,
	PasswordInputControl,
	PasswordInputToggle,
} from '@ui-sdk/react/password-input'
import { FormStatus } from '@/app/components/form-status'
import { SubmitButton } from '@/app/components/submit-button'
import { Wordmark } from '@/app/components/wordmark'
import { hasSession } from '@/lib/auth'
import { authConfig } from '@/lib/session'
import { login } from './actions'
import { loginMessage } from './messages'

export const metadata: Metadata = { title: 'Log in', robots: { index: false, follow: false } }

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
	if (await hasSession()) redirect('/admin')
	const { error } = await searchParams
	const message = loginMessage(error)

	if (!authConfig()) return <p className="card text-sm text-muted">Login is not configured.</p>

	return (
		<form action={login} className="card space-y-4">
			<Field>
				<FieldLabel>Password</FieldLabel>
				<PasswordInput name="password" autoComplete="current-password" required>
					<PasswordInputControl />
					<PasswordInputToggle aria-label="Show password" />
				</PasswordInput>
			</Field>
			{message && <FormStatus status="error" message={message} />}
			<div className="[&_[data-slot=button]]:w-full">
				<SubmitButton variant="solid">Log in</SubmitButton>
			</div>
		</form>
	)
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
	return (
		<main className="mx-auto w-full max-w-xs px-4 py-24">
			<div className="mb-6 space-y-3 text-center">
				<Wordmark className="text-lg" />
				<h1 className="text-xl font-semibold tracking-tight">Admin log in</h1>
			</div>
			<Suspense>
				<LoginForm searchParams={searchParams as Promise<{ error?: string }>} />
			</Suspense>
		</main>
	)
}
