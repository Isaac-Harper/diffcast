import { Button } from '@ui-sdk/react/button'
import Link from 'next/link'
import { CONTAINER } from '../components/site-chrome'

const KEPT = [
	'Your email address.',
	'Your interests, your takes and the stack you give us.',
	'Your feedback on episodes.',
] as const

const LEFT_OUT = [
	'Source code. We never ask for it.',
	'Private project and client names. They are never spoken in an episode.',
	'Anything that is not public. Episodes are scripted from public sources only.',
] as const

function Ledger({
	title,
	sign,
	tone,
	items,
}: {
	title: string
	sign: string
	tone: string
	items: readonly string[]
}) {
	return (
		<div>
			<h3 className="font-mono text-sm text-muted">{title}</h3>
			<ul className="mt-4 space-y-3">
				{items.map((item) => (
					<li key={item} className="flex gap-3 text-lg leading-7 text-pretty">
						<span aria-hidden="true" className={`w-4 shrink-0 font-mono ${tone}`}>
							{sign}
						</span>
						{item}
					</li>
				))}
			</ul>
		</div>
	)
}

export function PrivacySummary() {
	return (
		<section id="privacy" className="border-t border-line">
			<div className={`${CONTAINER} py-16 sm:py-24`}>
				<h2 className="text-title font-semibold text-balance">Privacy, in plain words.</h2>
				<div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-16">
					<Ledger title="What we keep" sign="+" tone="text-add" items={KEPT} />
					<Ledger title="What stays out" sign="-" tone="text-del" items={LEFT_OUT} />
				</div>
				<p className="mt-10 max-w-[62ch] leading-7 text-pretty text-muted">
					Your feed link is private and you can replace it at any time from your account. Payments
					go through Stripe; we never see your card. Ask and we delete your data.{' '}
					<Link href="/privacy" className="font-medium text-fg">
						Read the privacy page
					</Link>
				</p>
			</div>
		</section>
	)
}

const INCLUDED = [
	'An episode every morning, about ten minutes, on the days you pick.',
	'Daily news on weekdays, your week in review on Saturday, the week ahead on Sunday.',
	'Two hosts with ElevenLabs voices.',
	'A private feed that works in any podcast app.',
	'Show notes with the sources for every segment.',
] as const

export function Pricing() {
	return (
		<section id="pricing" className="border-t border-line">
			<div className={`${CONTAINER} py-16 sm:py-24`}>
				<div className="grid gap-10 rounded-card border border-line bg-surface p-7 sm:p-10 md:grid-cols-[auto_1fr] md:items-center md:gap-16">
					<div>
						<h2 className="font-mono text-sm text-muted">Standard</h2>
						<p className="mt-3 flex items-baseline gap-2">
							<span className="text-6xl font-semibold tracking-tighter tabular-nums">$25</span>
							<span className="text-lg text-muted">a month</span>
						</p>
					</div>
					<div className="space-y-5">
						<p className="max-w-[56ch] text-lg leading-8 text-pretty">
							One plan, billed monthly from the day you start. Cancel any time and episodes continue
							to the end of the month you paid for.
						</p>
						<ul className="space-y-1.5 text-muted">
							{INCLUDED.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
						<p className="max-w-[56ch] leading-7 text-pretty">
							<span className="font-medium">Pro, coming at $39 a month:</span>{' '}
							<span className="text-muted">
								fifteen minute episodes, with on demand episodes later.
							</span>
						</p>
						<Button data-variant="solid" render={<Link href="/start" />}>
							Start for $25 a month
						</Button>
					</div>
				</div>
			</div>
		</section>
	)
}
