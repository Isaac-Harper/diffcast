import type { Segment } from '@shared/contract'

export function SegmentList({ segments }: { segments: Segment[] }) {
	return (
		<ol className="space-y-3">
			{segments.map((segment) => (
				<li key={segment.heading}>
					<p className="font-medium">{segment.heading}</p>
					{segment.packages.length > 0 && (
						<p className="font-mono text-xs text-muted">{segment.packages.join(', ')}</p>
					)}
					<ul className="mt-1 space-y-0.5 text-sm">
						{segment.sources.map((source) => (
							<li key={source.url}>
								<a
									href={source.url}
									target="_blank"
									rel="noopener noreferrer"
									className="break-words underline decoration-edge underline-offset-2 hover:decoration-fg"
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
