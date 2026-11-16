import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { hasSession } from '@/lib/auth'
import { authConfig } from '@/lib/session'
import { login } from './actions'

export const metadata: Metadata = { title: 'Log in', robots: { index: false, follow: false } }

const ERRORS: Record<string, string> = {
	invalid: 'Wrong password.',
	throttled: 'Too many attempts. Wait ten minutes and try again.',
}

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
	if (await hasSession()) redirect('/admin')
	const { error } = await searchParams
	const message = error ? ERRORS[error] : undefined

	if (!authConfig()) return <p className="card muted text-sm">Login is not configured.</p>

	return (
		<form action={login} className="card space-y-3">
			<div>
				<label htmlFor="password" className="label">
					Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					autoComplete="current-password"
					required
					className="input"
				/>
			</div>
			{message && (
				<p role="alert" className="text-sm text-red-600">
					{message}
				</p>
			)}
			<button type="submit" className="btn btn-primary w-full">
				Log in
			</button>
		</form>
	)
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
	return (
		<main className="mx-auto w-full max-w-xs px-4 py-24">
			<h1 className="mb-4 text-xl font-semibold">Diffcast admin</h1>
			<Suspense>
				<LoginForm searchParams={searchParams as Promise<{ error?: string }>} />
			</Suspense>
		</main>
	)
}
