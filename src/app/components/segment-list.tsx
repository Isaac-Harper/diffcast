import type { Segment } from '@shared/contract'

export function SegmentList({ segments }: { segments: Segment[] }) {
	return (
		<ol className="space-y-3">
			{segments.map((segment, index) => (
				<li key={index}>
					<p className="font-medium">{segment.heading}</p>
					{segment.packages.length > 0 && (
						<p className="muted font-mono text-xs">{segment.packages.join(', ')}</p>
					)}
					<ul className="mt-1 space-y-0.5 text-sm">
						{segment.sources.map((source) => (
							<li key={source.url}>
								<a
									href={source.url}
									target="_blank"
									rel="noopener noreferrer"
									className="break-words underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
								>
									{source.title}
								</a>
							</li>
						))}
					</ul>
				</li>
			))}
		</ol>
	)
}
