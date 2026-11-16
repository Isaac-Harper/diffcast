import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, SELLER_NAME } from '@/lib/site'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

export const metadata: Metadata = {
	title: 'Terms',
	description:
		'The terms of a Diffcast subscription: monthly billing, cancelling, refunds and what an episode is.',
	alternates: { canonical: '/terms' },
}

const SECTIONS = [
	{
		heading: 'Who you are buying from',
		paragraphs: [
			`Diffcast is sold and run by ${SELLER_NAME}. Write to ${CONTACT_EMAIL} with any question about your subscription.`,
		],
	},
	{
		heading: 'The subscription',
		paragraphs: [
			'Diffcast Standard is a monthly subscription at $25 a month. You are charged when you subscribe and again on the same day each month until you cancel. Payments are processed by Stripe.',
			'Each subscription is for one person. Your feed link is personal; sharing it is like sharing a password.',
		],
	},
	{
		heading: 'Cancelling',
		paragraphs: [
			'Cancel any time: sign in, open your account and choose Manage billing. Service continues to the end of the period you already paid for, and you are not charged again.',
			'If a renewal payment fails, episodes keep coming while Stripe retries the card. If it cannot collect the payment, the subscription ends and new episodes stop.',
		],
	},
	{
		heading: 'Refunds',
		paragraphs: [
			`If Diffcast is not for you, ask within 7 days of your first charge and we refund it in full. Write to ${CONTACT_EMAIL} from the email you subscribed with. Later charges are not refunded, but you can cancel before the next one.`,
		],
	},
	{
		heading: 'What an episode is',
		paragraphs: [
			'Episodes are written and voiced by AI from public sources such as reporting, announcements, release notes, changelogs and security advisories. Every segment lists its sources in the show notes.',
			'An episode can contain mistakes, leave things out or describe a story imperfectly. Check the sources before acting on anything you hear.',
			'Episodes are news and commentary, not professional advice: not legal, financial, security or medical advice.',
		],
	},
	{
		heading: 'Changes',
		paragraphs: [
			'If the price or these terms change, we email you before the change applies to your next charge, so you can cancel first.',
		],
	},
] as const

export default function TermsPage() {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
				<p className="font-mono text-sm text-muted">Last updated November 16, 2026</p>
				<h1 className="mt-3 text-title font-semibold text-balance">Terms</h1>
				<p className="mt-5 text-lg leading-8 text-pretty text-muted">
					The short version: $25 a month, cancel any time and keep listening until the end of the
					month you paid for, a full refund if you ask within 7 days of your first charge.
				</p>
				{SECTIONS.map((section) => (
					<section key={section.heading} className="mt-12">
						<h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
						<div className="mt-4 space-y-4 leading-7 text-pretty">
							{section.paragraphs.map((paragraph) => (
								<p key={paragraph}>{paragraph}</p>
							))}
						</div>
					</section>
				))}
				<p className="mt-14 border-t border-line pt-6">
					<Link href="/" className="font-medium">
						Back to Diffcast
					</Link>
				</p>
			</main>
			<SiteFooter />
		</>
	)
}
