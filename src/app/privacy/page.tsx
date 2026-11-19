import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/site'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

export const metadata: Metadata = {
	title: 'Privacy',
	description:
		'What Diffcast stores, what never goes into an episode, who processes payments and email, and how to have your data deleted.',
	alternates: { canonical: '/privacy' },
}

const SECTIONS = [
	{
		heading: 'What we store',
		paragraphs: [
			'Your email address, for your feed link, sign in links and messages about your subscription.',
			'Your time zone and the days you want episodes.',
			'What you tell us you want to hear about: your interests, any takes you add to them, and notes about what you work on.',
			'The stack you give us. If you paste a file such as a package.json when you sign up, we keep that text with your signup and turn it into a list of package names for your episodes.',
			'Your feedback: whether you listened, whether an episode was useful and any notes you write.',
			'Work context, if you connect a coding agent: the project alias, package names, topics and one line summary your agent sends. Each entry is kept for 30 days from its last update and then dropped; your agent or a request to us can delete it sooner. We also keep which agents you connected and when they were last used, and only hashes of their access tokens.',
			'Billing references from Stripe: your Stripe customer and subscription ids, the subscription status and when the current period ends. We never see or store your card number.',
			'Basic delivery records for your private feed, such as when a podcast app last fetched it and which episodes it downloaded.',
			'Anonymous counts of steps on the site: a view of the home page, a play of the sample episode, a started signup or checkout, a completed payment and an ended subscription. Each count is only the step and the time, with no cookie, address or account attached.',
		],
	},
	{
		heading: 'What goes into an episode',
		paragraphs: [
			'Episodes are scripted from public sources only: reporting, announcements, release notes, changelogs and security advisories.',
			'Your interests and takes shape which stories are chosen and how they are argued. A take may be referred to in your own episode, which only you receive.',
			'Your private project names and client names are never spoken in an episode and never written into its title or show notes. That includes the project names and summaries your agent sends as work context: the writing service sees them only as "private project 1" and similar, and a script that names one fails a check and is rewritten.',
			'We never ask for source code.',
		],
	},
	{
		heading: 'Your feed link',
		paragraphs: [
			'Each listener gets a private feed link. Anyone who has the link can hear your episodes, so treat it like a password.',
			'You can replace your link and revoke the old ones at any time from your account.',
		],
	},
	{
		heading: 'Other companies involved',
		paragraphs: [
			'Diffcast runs on hosted infrastructure, and episodes are written and voiced with third party AI services. To write an episode, the writing service receives your interests, your takes, your package list, any notes you gave us about what you work on, and the packages and topics from your work context, with project names replaced by labels. To voice it, the speech service receives the finished script, which is built from public news.',
			'We have not verified how long those providers retain what they process, so we make no promise about it. This is why private names are kept out of scripts.',
			'Payments are handled by Stripe. Stripe holds your name, email, card or other payment details, billing address and your invoice and payment history, under its own privacy policy. We see only the references listed above and the amounts charged.',
			'Email is sent through Resend, which receives your email address and the message: your welcome email, sign in links and subscription notices.',
			'Visits to our public pages are counted with Vercel Web Analytics, which uses no cookies and identifies no one. It sees the page address and basic device and browser details; pages with a private link, your account and sign in links are never sent to it.',
		],
	},
	{
		heading: 'Deletion',
		paragraphs: [
			`Ask and we delete your data: your email, your interests, your stack, your feedback and your episodes. To ask, write to ${CONTACT_EMAIL}. Stripe keeps payment records it is required to keep by law.`,
			'Cancelling stops new episodes but does not delete anything, so you can come back where you left off. Ask if you want it deleted.',
		],
	},
	{
		heading: 'Changes',
		paragraphs: [
			'This page describes what is true today and will change as the product does. We email subscribers before a change that affects them.',
		],
	},
] as const

export default function PrivacyPage() {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
				<p className="font-mono text-sm text-muted">Last updated November 18, 2026</p>
				<h1 className="mt-3 text-title font-semibold text-balance">Privacy</h1>
				<p className="mt-5 text-lg leading-8 text-pretty text-muted">
					The short version: we keep your email, your interests, the stack you give us and your
					feedback. Episodes are made from public sources. You can have everything deleted by
					asking.
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
