import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

export const metadata: Metadata = {
	title: 'Privacy',
	description:
		'What Diffcast stores during the prototype, what never goes into an episode, and how to have your data deleted.',
	alternates: { canonical: '/privacy' },
}

const SECTIONS = [
	{
		heading: 'What we store',
		paragraphs: [
			'Your email address, so we can reach you about the prototype.',
			'What you tell us you want to hear about: your interests, any takes you add to them, and notes about what you work on.',
			'The stack you give us. If you paste a file such as a package.json when you join the list, we keep that text until we turn it into a list of package names for your episodes, or until you ask us to delete it.',
			'Your feedback: whether you listened, whether an episode was useful, any notes you write, and your answer to the pricing question.',
			'Basic delivery records for your private feed, such as when a podcast app last fetched it and which episodes it downloaded.',
		],
	},
	{
		heading: 'What goes into an episode',
		paragraphs: [
			'Episodes are scripted from public sources only: reporting, announcements, release notes, changelogs and security advisories.',
			'Your interests and takes shape which stories are chosen and how they are argued. A take may be referred to in your own episode, which only you receive.',
			'Your private project names and client names are never spoken in an episode and never written into its title or show notes.',
			'We never ask for source code.',
		],
	},
	{
		heading: 'Your feed link',
		paragraphs: [
			'Each listener gets a private feed link. Anyone who has the link can hear your episodes, so treat it like a password.',
			'A link can be revoked and replaced at any time. Ask and we will issue a new one.',
		],
	},
	{
		heading: 'Other companies involved',
		paragraphs: [
			'Diffcast runs on hosted infrastructure, and episodes are written and voiced with third party AI services. To write an episode, the writing service receives your interests, your takes, your package list and any notes you gave us about what you work on. To voice it, the speech service receives the finished script, which is built from public news.',
			'We have not verified how long those providers retain what they process, so we make no promise about it. This is why private names are kept out of scripts.',
		],
	},
	{
		heading: 'Deletion',
		paragraphs: [
			'Ask and we delete your data: your email, your interests, your stack, your feedback and your episodes. To ask, reply to any email you have received from us.',
		],
	},
	{
		heading: 'Changes',
		paragraphs: [
			'Diffcast is a small, invite only prototype. This page describes what is true today and will change as the product does.',
		],
	},
] as const

export default function PrivacyPage() {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
				<p className="font-mono text-sm text-muted">Last updated November 16, 2026</p>
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
