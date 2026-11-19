import { SAMPLE_AUDIO_PATH } from '@/lib/sample'
import type { Sample } from '@/lib/sample'

export function minutesLabel(seconds: number): string {
	return `${Math.max(1, Math.round(seconds / 60))} min`
}

export function SamplePlayer({ sample }: { sample: Sample }) {
	return (
		<figure className="space-y-3 rounded-card border border-line bg-surface p-4">
			<figcaption className="flex flex-wrap justify-between gap-x-4 font-mono text-xs text-muted">
				<span className="text-fg">sample episode</span>
				<span>{minutesLabel(sample.durationSeconds)}</span>
			</figcaption>
			<p className="font-medium text-pretty">{sample.title}</p>
			<audio
				controls
				preload="none"
				src={SAMPLE_AUDIO_PATH}
				aria-label={`Play the sample episode: ${sample.title}`}
				className="w-full"
			/>
		</figure>
	)
}

export function SampleSegments({ sample }: { sample: Sample }) {
	return (
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
										className="inline-block py-0.5 underline decoration-line underline-offset-4"
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
	)
}
