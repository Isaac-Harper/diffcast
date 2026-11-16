import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { logout } from '@/app/login/actions'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = {
	title: { default: 'Admin', template: '%s · Diffcast admin' },
	robots: { index: false, follow: false },
}

const LINKS = [
	{ href: '/admin', label: 'Gate' },
	{ href: '/admin/listeners', label: 'Listeners' },
	{ href: '/admin/episodes', label: 'Episodes' },
	{ href: '/admin/runs', label: 'Runs' },
] as const

async function Guarded({ children }: { children: ReactNode }) {
	await requireSession()
	return children
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6">
			<nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
				<span className="font-mono font-semibold">diffcast</span>
				{LINKS.map((link) => (
					<Link key={link.href} href={link.href} className="hover:underline">
						{link.label}
					</Link>
				))}
				<form action={logout} className="ml-auto">
					<button type="submit" className="muted hover:underline">
						Log out
					</button>
				</form>
			</nav>
			<Suspense fallback={<p className="muted">Loading…</p>}>
				<Guarded>{children}</Guarded>
			</Suspense>
		</div>
	)
}
