import { Button } from '@ui-sdk/react/button'
import Link from 'next/link'
import { CONTAINER } from '../components/site-chrome'
import { loadSample } from '@/lib/sample'
import { BriefPanel } from './brief-panel'
import { SamplePlayer } from './sample-episode'

export function Hero() {
	const sample = loadSample()
	return (
		<section
			className={`${CONTAINER} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.35fr_1fr] lg:gap-16 lg:py-24`}
		>
			<div className="space-y-7">
				<h1 className="text-display font-semibold text-balance">
					A daily tech news podcast made from your interests and your stack.
				</h1>
				<p className="max-w-[34rem] text-lg leading-8 text-pretty text-muted">
					What changed in your corner of tech since yesterday, in about ten minutes each morning.
					Two hosts, a private feed for any podcast app, and every segment cited.
				</p>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<Button data-variant="solid" data-size="lg" render={<Link href="/start" />}>
						Start for $25 a month
					</Button>
					<Link href={sample ? '/sample' : '#episode'} className="text-[0.9375rem] font-medium">
						{sample ? 'Sample show notes' : 'Read sample show notes'}
					</Link>
				</div>
				{sample && (
					<div className="max-w-[34rem]">
						<SamplePlayer sample={sample} />
					</div>
				)}
			</div>
			<BriefPanel />
		</section>
	)
}
