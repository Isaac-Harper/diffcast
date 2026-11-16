import type { Metadata } from 'next'
import Link from 'next/link'
import { AgentSetup } from '../components/agent-setup'
import { SiteFooter, SiteHeader } from '../components/site-chrome'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
	title: 'Connect your agent',
	description:
		'Connect Claude Code, Cursor or claude.ai to Diffcast so your coding agent keeps your episodes following your work.',
	alternates: { canonical: '/agents' },
}

const TOOLS = [
	{
		name: 'push_context',
		does: 'Saves what you are working on: a project alias, its packages, the topics it touches and a one line summary. The next episode leans into them.',
	},
	{ name: 'list_context', does: 'Shows the work context Diffcast holds for you.' },
	{ name: 'clear_context', does: 'Deletes the work context for one project, or all of it.' },
	{ name: 'get_interests', does: 'Reads your interests, with their takes and notes.' },
	{ name: 'set_interests', does: 'Replaces your interest list.' },
	{ name: 'add_interest', does: 'Adds one interest.' },
	{ name: 'remove_interest', does: 'Removes one interest.' },
	{ name: 'get_schedule', does: 'Reads the days you get episodes and your time zone.' },
	{ name: 'set_days', does: 'Changes the days you get episodes.' },
	{
		name: 'get_latest_episode',
		does: 'Reads your newest episode: title, summary, segments and their sources.',
	},
	{ name: 'list_episodes', does: 'Reads up to 14 recent episodes.' },
] as const

const CANNOT = [
	'See or change billing, your email or your feed link.',
	'Read episode audio or full transcripts.',
	'Do anything once you disconnect it, or while your subscription is not active.',
] as const

export default function AgentsPage() {
	return (
		<>
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
				<p className="font-mono text-sm text-muted">Remote MCP server</p>
				<h1 className="mt-3 text-title font-semibold text-balance">Connect your agent</h1>
				<p className="mt-5 text-lg leading-8 text-pretty text-muted">
					Your coding agent knows what you are building this week. Connect it to Diffcast and it can
					tell us, so tomorrow&apos;s episode covers the packages and problems you are actually on,
					without you editing a list.
				</p>

				<section className="mt-12 space-y-4">
					<h2 className="text-xl font-semibold tracking-tight">Set it up</h2>
					<p className="leading-7 text-pretty">
						You need an active subscription. Add the server to your agent, and the first time it
						connects your browser opens Diffcast to ask you to allow it. If you are not signed in,
						Diffcast emails you a sign in link; open it in the same browser and you come straight
						back to finish.
					</p>
					<div className="rounded-card border border-line bg-surface p-6">
						<AgentSetup origin={SITE_URL} />
					</div>
				</section>

				<section className="mt-12 space-y-4">
					<h2 className="text-xl font-semibold tracking-tight">What your agent can do</h2>
					<div className="table-frame">
						<table className="data-table">
							<thead>
								<tr>
									<th>Tool</th>
									<th>What it does</th>
								</tr>
							</thead>
							<tbody>
								{TOOLS.map((tool) => (
									<tr key={tool.name}>
										<td className="font-mono text-xs whitespace-nowrap">{tool.name}</td>
										<td className="text-pretty">{tool.does}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<h3 className="pt-2 font-medium">It cannot</h3>
					<ul className="space-y-1.5 text-pretty text-muted">
						{CANNOT.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>

				<section className="mt-12 space-y-4 leading-7 text-pretty">
					<h2 className="text-xl font-semibold tracking-tight">What it stores, and for how long</h2>
					<p>
						Work context is the project alias, up to 200 package names, up to 20 topics and a
						summary of at most 300 characters. Each entry is kept for 30 days from its last update,
						then dropped. Your agent can clear it at any time with clear_context.
					</p>
					<p>
						Project names and summaries are never spoken or written in an episode. The writing
						service only sees them as &quot;private project 1&quot; and similar, and a script that
						names one is rejected and rewritten. Packages and topics are what shape the episode.
					</p>
					<p>
						Your agent can push context at most 60 times a day. Never send code, secrets or client
						names: Diffcast rejects anything that does not look like a plain package name or plain
						words.
					</p>
				</section>

				<section className="mt-12 space-y-4 leading-7 text-pretty">
					<h2 className="text-xl font-semibold tracking-tight">Disconnecting</h2>
					<p>
						Open{' '}
						<Link href="/account" className="font-medium">
							your account
						</Link>{' '}
						and press Disconnect next to the agent under Connected agents. Its access stops at once.
						Access tokens last an hour and renew for up to 60 days of use; disconnecting ends them
						all.
					</p>
				</section>
			</main>
			<SiteFooter />
		</>
	)
}
