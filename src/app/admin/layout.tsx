import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { SubmitButton } from '@/app/components/submit-button'
import { Toaster } from '@/app/components/toaster'
import { Wordmark } from '@/app/components/wordmark'
import { logout } from '@/app/login/actions'
import { requireSession } from '@/lib/auth'
import { AdminNav } from './admin-nav'

export const metadata: Metadata = {
	title: { default: 'Admin', template: '%s · Diffcast admin' },
	robots: { index: false, follow: false },
}

async function Guarded({ children }: { children: ReactNode }) {
	await requireSession()
	return children
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6">
			<nav
				aria-label="Admin"
				className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-line pb-3 text-sm"
			>
				<Link href="/admin" className="mr-3 rounded-control">
					<Wordmark />
				</Link>
				<Suspense>
					<AdminNav />
				</Suspense>
				<form action={logout} className="ml-auto">
					<SubmitButton variant="quiet">Log out</SubmitButton>
				</form>
			</nav>
			<Suspense fallback={<p className="text-muted">Loading…</p>}>
				<Guarded>{children}</Guarded>
			</Suspense>
			<Toaster />
		</div>
	)
}
