import { CopyButton } from './copy-button'

export function UrlRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<p className="text-sm font-medium">{label}</p>
			<div className="flex items-center gap-2">
				<code className="code-chip">{value}</code>
				<CopyButton value={value} label={label} />
			</div>
		</div>
	)
}

export function FeedLinks({ feedUrl, pageUrl }: { feedUrl: string; pageUrl: string }) {
	return (
		<div className="card space-y-4 border-warn-line bg-warn-soft">
			<p className="text-sm">Shown once. Copy both now, and keep them private.</p>
			<UrlRow label="Feed URL" value={feedUrl} />
			<UrlRow label="Listener page" value={pageUrl} />
			<div className="space-y-1 text-sm text-pretty">
				<p>
					<span className="font-medium">Apple Podcasts:</span> open Library, tap the ••• menu,
					choose Follow a Show by URL, then paste the feed URL.
				</p>
				<p>
					<span className="font-medium">Overcast:</span> tap +, choose Add URL, then paste it.
				</p>
				<p className="text-muted">Any podcast app that can follow a show by URL works.</p>
			</div>
		</div>
	)
}
