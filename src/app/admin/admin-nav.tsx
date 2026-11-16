'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
	{ href: '/admin', label: 'Gate' },
	{ href: '/admin/listeners', label: 'Listeners' },
	{ href: '/admin/waitlist', label: 'Waitlist' },
	{ href: '/admin/episodes', label: 'Episodes' },
	{ href: '/admin/runs', label: 'Runs' },
] as const

function isCurrent(pathname: string, href: string): boolean {
	if (href === '/admin') return pathname === '/admin'
	return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav() {
	const pathname = usePathname()
	return (
		<>
			{LINKS.map((link) => {
				const current = isCurrent(pathname, link.href)
				return (
					<Link
						key={link.href}
						href={link.href}
						aria-current={current ? 'page' : undefined}
						className={
							current
								? 'rounded-control bg-sunken px-2.5 py-1 font-medium text-fg no-underline'
								: 'rounded-control px-2.5 py-1 font-medium text-muted no-underline hover:bg-sunken hover:text-fg'
						}
					>
						{link.label}
					</Link>
				)
			})}
		</>
	)
}
