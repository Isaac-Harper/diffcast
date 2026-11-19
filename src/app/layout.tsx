import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'
import { PublicAnalytics } from './components/browser-events'
import './globals.css'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
	description: SITE_DESCRIPTION,
	applicationName: SITE_NAME,
	openGraph: {
		type: 'website',
		siteName: SITE_NAME,
		title: `${SITE_NAME}: ${SITE_TAGLINE}`,
		description: SITE_DESCRIPTION,
		url: '/',
	},
	twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#f8f9f9' },
		{ media: '(prefers-color-scheme: dark)', color: '#0e1011' },
	],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
	return (
		<html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<body className="flex min-h-full flex-col">
				{children}
				<Suspense>
					<PublicAnalytics />
				</Suspense>
			</body>
		</html>
	)
}
