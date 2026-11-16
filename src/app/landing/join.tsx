import { Button } from '@ui-sdk/react/button'
import Link from 'next/link'
import { CONTAINER } from '../components/site-chrome'

export function Join() {
	return (
		<section id="join" className="border-t border-line bg-sunken">
			<div
				className={`${CONTAINER} grid gap-8 py-16 sm:py-24 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16`}
			>
				<div>
					<h2 className="text-title font-semibold text-balance">Tomorrow morning, your diff.</h2>
					<p className="mt-4 max-w-[48ch] text-lg leading-8 text-pretty text-muted">
						Tell us what you follow, pay on the next page and add your private feed to any podcast
						app. The first episode lands on the next morning you picked.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<Button data-variant="solid" data-size="lg" render={<Link href="/start" />}>
						Start for $25 a month
					</Button>
					<Link href="/signin" className="text-[0.9375rem] font-medium">
						Sign in
					</Link>
				</div>
			</div>
		</section>
	)
}
