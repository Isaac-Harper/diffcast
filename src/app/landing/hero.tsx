import { Button } from '@ui-sdk/react/button'
import Link from 'next/link'
import { CONTAINER } from '../components/site-chrome'
import { BriefPanel } from './brief-panel'

export function Hero() {
	return (
		<section
			className={`${CONTAINER} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.35fr_1fr] lg:gap-16 lg:py-24`}
		>
			<div className="space-y-7">
				<h1 className="text-display font-semibold text-balance">
					What changed in your corner of tech since yesterday.
				</h1>
				<p className="max-w-[34rem] text-lg leading-8 text-pretty text-muted">
					A private podcast on tech and AI news every morning, tuned to your interests and your
					stack. Weekdays bring the news, weekends a recap and a look ahead. Every segment cited.
				</p>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<Button data-variant="solid" data-size="lg" render={<Link href="#join" />}>
						Join the prototype
					</Button>
					<Link href="#episode" className="text-[0.9375rem] font-medium">
						Read sample show notes
					</Link>
				</div>
			</div>
			<BriefPanel />
		</section>
	)
}
