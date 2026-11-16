import { Button } from '@ui-sdk/react/button'
import Link from 'next/link'
import { SITE_TAGLINE } from '@/lib/site'
import { Wordmark } from './wordmark'

export const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8'

const SECTIONS = [
	{ href: '/#how', label: 'How it works' },
	{ href: '/#episode', label: 'An episode' },
	{ href: '/#privacy', label: 'Privacy' },
	{ href: '/#pricing', label: 'Pricing' },
	{ href: '/#faq', label: 'FAQ' },
] as const

export function SiteHeader() {
	return (
		<header className="border-b border-line">
			<div className={`${CONTAINER} flex h-16 items-center gap-8`}>
				<Link href="/" className="no-underline" aria-label="Diffcast home">
					<Wordmark className="text-[0.9375rem]" />
				</Link>
				<nav aria-label="Sections" className="hidden items-center gap-6 text-sm md:flex">
					{SECTIONS.map((section) => (
						<Link
							key={section.href}
							href={section.href}
							className="text-muted no-underline transition-colors hover:text-fg"
						>
							{section.label}
						</Link>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-5">
					<Link href="/signin" className="text-sm text-muted no-underline hover:text-fg">
						Sign in
					</Link>
					<Button data-variant="solid" render={<Link href="/start" />}>
						Start
					</Button>
				</div>
			</div>
		</header>
	)
}

export function SiteFooter() {
	return (
		<footer className="mt-auto border-t border-line">
			<div
				className={`${CONTAINER} flex flex-col gap-6 py-10 text-sm sm:flex-row sm:items-center sm:justify-between`}
			>
				<div className="space-y-2">
					<Wordmark />
					<p className="text-muted">{SITE_TAGLINE}</p>
				</div>
				<nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
					<Link href="/agents" className="text-muted no-underline hover:text-fg">
						Agents
					</Link>
					<Link href="/terms" className="text-muted no-underline hover:text-fg">
						Terms
					</Link>
					<Link href="/privacy" className="text-muted no-underline hover:text-fg">
						Privacy
					</Link>
					<Link href="/signin" className="text-muted no-underline hover:text-fg">
						Sign in
					</Link>
					<span className="text-muted">© 2026 Diffcast</span>
				</nav>
			</div>
		</footer>
	)
}
