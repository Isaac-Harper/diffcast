const INTERESTS = [
	{ topic: 'AI models and agents', take: 'agents are overhyped' },
	{ topic: 'Developer tools', take: null },
	{ topic: 'Security', take: null },
	{ topic: 'Startups', take: 'most AI wrappers will not last' },
] as const

type StackLine = { change: 'same' | 'removed' | 'added'; name: string; version: string }

const STACK: StackLine[] = [
	{ change: 'same', name: 'react', version: '19.3.0' },
	{ change: 'removed', name: 'next', version: '16.4.5' },
	{ change: 'added', name: 'next', version: '16.4.6' },
	{ change: 'same', name: 'zod', version: '4.6.7' },
]

const ROW = {
	same: 'text-muted',
	removed: 'bg-del-soft text-del',
	added: 'bg-add-soft text-add',
} as const

const SIGN = { same: ' ', removed: '-', added: '+' } as const

function StackEntry({ line }: { line: StackLine }) {
	const text = (
		<>
			<span className="min-w-0 truncate">{line.name}</span>
			<span className="ml-auto tabular-nums">{line.version}</span>
		</>
	)
	const layout = 'flex min-w-0 flex-1 gap-4 no-underline'
	if (line.change === 'removed') return <del className={layout}>{text}</del>
	if (line.change === 'added') return <ins className={layout}>{text}</ins>
	return <span className={layout}>{text}</span>
}

export function BriefPanel() {
	return (
		<figure className="overflow-hidden rounded-card border border-line bg-surface font-mono text-[0.8125rem] shadow-[0_24px_48px_-32px_rgb(17_20_21/0.35)]">
			<figcaption className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 text-muted">
				<span className="text-fg">your brief</span>
				<span>sample</span>
			</figcaption>
			<div className="py-3">
				<p className="px-4 pb-1 text-muted">interests</p>
				<ul className="leading-7">
					{INTERESTS.map((interest, index) => (
						<li
							key={interest.topic}
							className="diff-line flex flex-wrap gap-x-3 px-4"
							style={{ animationDelay: `${index * 45}ms` }}
						>
							<span className="font-sans text-[0.9375rem] font-medium">{interest.topic}</span>
							{interest.take && <span className="text-muted">take: {interest.take}</span>}
						</li>
					))}
				</ul>
				<p className="px-4 pt-4 pb-1 text-muted">stack, since yesterday</p>
				<ol className="leading-7">
					{STACK.map((line, index) => (
						<li
							key={`${line.change}:${line.name}`}
							className={`diff-line flex gap-3 px-4 ${ROW[line.change]}`}
							style={{ animationDelay: `${(INTERESTS.length + index) * 45}ms` }}
						>
							<span aria-hidden="true" className="w-3 shrink-0 text-center select-none">
								{SIGN[line.change]}
							</span>
							<StackEntry line={line} />
						</li>
					))}
				</ol>
			</div>
			<p className="border-t border-line px-4 py-3 font-sans text-sm text-muted">
				<span className="font-medium text-fg">Four interests, one stack change.</span>{' '}
				Tomorrow&apos;s episode is built from these and nothing else.
			</p>
		</figure>
	)
}
