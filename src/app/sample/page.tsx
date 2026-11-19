import { Button } from '@ui-sdk/react/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CONTAINER, SiteFooter, SiteHeader } from '../components/site-chrome'
import { minutesLabel, SamplePlayer, SampleSegments } from '../landing/sample-episode'
import { loadSample } from '@/lib/sample'
import { SITE_NAME } from '@/lib/site'

const TITLE = 'Hear a sample episode'
const DESCRIPTION =
	'A public Diffcast episode made for a generic developer: two hosts, about ten minutes of tech and AI news, every segment cited. Yours is built from your own interests and stack.'

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: '/sample' },
	openGraph: {
		type: 'website',
		siteName: SITE_NAME,
		title: `${TITLE} · ${SITE_NAME}`,
		description: DESCRIPTION,
		url: '/sample',
	},
	twitter: { card: 'summary_large_image' },
}

export default function SamplePage() {
	const sample = loadSample()
	if (!sample) notFound()
	return (
		<>
			<SiteHeader />
			<main
				className={`${CONTAINER} grid gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-16`}
			>
				<div className="space-y-7">
					<p className="font-mono text-sm text-muted">
						{sample.publishedOn} · {minutesLabel(sample.durationSeconds)} · public sample
					</p>
					<h1 className="text-title font-semibold text-balance">{sample.title}</h1>
					<p className="max-w-[46ch] text-lg leading-8 text-pretty text-muted">{sample.summary}</p>
					<SamplePlayer sample={sample} />
					<p className="max-w-[46ch] leading-7 text-pretty text-muted">
						This one was made for no one in particular. Yours follows your interests, your takes and
						the packages in your stack, on the days you pick.
					</p>
					<Button data-variant="solid" data-size="lg" render={<Link href="/start" />}>
						Start for $25 a month
					</Button>
				</div>
				<section aria-label="Show notes">
					<h2 className="font-mono text-sm text-muted">Show notes</h2>
					<SampleSegments sample={sample} />
				</section>
			</main>
			<SiteFooter />
		</>
	)
}
