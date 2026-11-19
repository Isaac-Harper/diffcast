import { CONTAINER } from '../components/site-chrome'
import { loadSample, SAMPLE_AUDIO_PATH } from '@/lib/sample'
import type { Sample } from '@/lib/sample'

const PARTS = [
	{
		name: 'Cold open',
		body: 'The most important story for you today, first.',
	},
	{
		name: 'News',
		body: 'Three to five segments across your interests, mostly tech and AI. Each one lists the sources it was built from.',
	},
	{
		name: 'Your stack',
		body: 'At most one segment, and only on days something real changed in your packages.',
	},
	{
		name: 'Challenge',
		body: 'Sometimes the hosts make the strongest case against one of your takes.',
	},
	{
		name: 'Wildcard',
		body: 'Sometimes one story from a field next to yours.',
	},
	{
		name: 'What to watch',
		body: 'A close on what is coming this week.',
	},
] as const

const WEEKEND = [
	{
		name: 'Saturday: your week in review',
		body: 'The biggest stories of the week in your corner of tech, what moved since and what is still developing. Still cited, story by story.',
	},
	{
		name: 'Sunday: the week ahead',
		body: 'A short look at what is coming: releases, deprecations, events and decisions, with when each one lands.',
	},
] as const

const NOTES = [
	{
		kind: 'news',
		topic: 'AI models and agents',
		heading: 'A new open weights model, and what its benchmarks leave out',
		sources: ['The release post and model card', 'An independent evaluation'],
	},
	{
		kind: 'news',
		topic: 'Security',
		heading: 'A compromised package on a public registry: who is exposed',
		sources: ['The registry advisory', 'The maintainer’s incident report'],
	},
	{
		kind: 'stack',
		topic: 'next',
		heading: 'A Next.js patch release, and who should take it today',
		sources: ['Release notes, github.com/vercel/next.js'],
	},
	{
		kind: 'challenge',
		topic: 'your take: agents are overhyped',
		heading: 'The strongest case that coding agents already pay for themselves',
		sources: ['Two published engineering write ups'],
	},
	{
		kind: 'watch',
		topic: 'Developer tools',
		heading: 'Due this week: a TypeScript release candidate',
		sources: ['Iteration plan, github.com/microsoft/TypeScript'],
	},
] as const

function ShowNotes() {
	return (
		<article
			aria-label="Sample show notes"
			className="rounded-card border border-line bg-surface p-5 sm:p-7"
		>
			<header className="space-y-2 border-b border-line pb-5">
				<p className="flex flex-wrap justify-between gap-x-4 font-mono text-xs text-muted">
					<span>Mon, Nov 16 · 10 min</span>
					<span>sample, not a real episode</span>
				</p>
				<h3 className="text-xl font-semibold tracking-tight text-balance">
					A new open model, a registry compromise and one change in your stack
				</h3>
			</header>
			<ol>
				{NOTES.map((note) => (
					<li key={note.heading} className="grid grid-cols-[5.25rem_1fr] gap-x-3 pt-5">
						<span className="pt-0.5 font-mono text-xs text-add">{note.kind}</span>
						<div className="space-y-1.5">
							<p className="font-medium text-pretty">{note.heading}</p>
							<p className="font-mono text-xs text-muted">{note.topic}</p>
							<ul className="space-y-0.5 text-sm text-muted">
								{note.sources.map((source) => (
									<li key={source} className="flex gap-2">
										<span aria-hidden="true">↳</span>
										<span className="underline decoration-line underline-offset-4">{source}</span>
									</li>
								))}
							</ul>
						</div>
					</li>
				))}
			</ol>
		</article>
	)
}

function minutesLabel(seconds: number): string {
	return `${Math.max(1, Math.round(seconds / 60))} min`
}

function SampleEpisode({ sample }: { sample: Sample }) {
	return (
		<article
			aria-label="Sample episode"
			className="rounded-card border border-line bg-surface p-5 sm:p-7"
		>
			<header className="space-y-2 border-b border-line pb-5">
				<p className="flex flex-wrap justify-between gap-x-4 font-mono text-xs text-muted">
					<span>
						{sample.publishedOn} · {minutesLabel(sample.durationSeconds)}
					</span>
					<span>public sample, made for no one in particular</span>
				</p>
				<h3 className="text-xl font-semibold tracking-tight text-balance">{sample.title}</h3>
			</header>
			<audio
				controls
				preload="none"
				src={SAMPLE_AUDIO_PATH}
				aria-label={`Play the sample episode: ${sample.title}`}
				className="mt-5 w-full"
			/>
			<ol>
				{sample.segments.map((segment) => (
					<li key={segment.heading} className="grid grid-cols-[5.25rem_1fr] gap-x-3 pt-5">
						<span className="pt-0.5 font-mono text-xs text-add">{segment.kind}</span>
						<div className="space-y-1.5">
							<p className="font-medium text-pretty">{segment.heading}</p>
							<ul className="space-y-0.5 text-sm text-muted">
								{segment.sources.map((source) => (
									<li key={source.url} className="flex gap-2">
										<span aria-hidden="true">↳</span>
										<a
											href={source.url}
											rel="noreferrer"
											className="underline decoration-line underline-offset-4"
										>
											{source.title}
										</a>
									</li>
								))}
							</ul>
						</div>
					</li>
				))}
			</ol>
		</article>
	)
}

export function Episode() {
	const sample = loadSample()
	return (
		<section id="episode" className="border-t border-line bg-sunken">
			<div className={`${CONTAINER} grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-16`}>
				<div>
					<h2 className="text-title font-semibold text-balance">
						Ten minutes, made for one listener.
					</h2>
					<p className="mt-4 max-w-[46ch] text-lg leading-8 text-pretty text-muted">
						Every segment cites its sources, and Diffcast never pads. A quiet day is a short
						episode.
					</p>
					<dl className="mt-10 space-y-5">
						{PARTS.map((part) => (
							<div key={part.name} className="border-l-2 border-fg pl-5">
								<dt className="font-medium">{part.name}</dt>
								<dd className="mt-1 max-w-[48ch] leading-7 text-pretty text-muted">{part.body}</dd>
							</div>
						))}
					</dl>
					<h3 className="mt-12 font-mono text-sm text-muted">On weekends</h3>
					<dl className="mt-5 space-y-5">
						{WEEKEND.map((part) => (
							<div key={part.name} className="border-l-2 border-fg pl-5">
								<dt className="font-medium">{part.name}</dt>
								<dd className="mt-1 max-w-[48ch] leading-7 text-pretty text-muted">{part.body}</dd>
							</div>
						))}
					</dl>
				</div>
				{sample ? <SampleEpisode sample={sample} /> : <ShowNotes />}
			</div>
		</section>
	)
}
