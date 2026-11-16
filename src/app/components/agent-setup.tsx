import { CopyButton } from './copy-button'

function Snippet({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start gap-2">
			<pre className="min-w-0 flex-1 rounded-control border border-line bg-sunken px-2.5 py-2 font-mono text-xs break-all whitespace-pre-wrap">
				{value}
			</pre>
			<CopyButton value={value} label={label} />
		</div>
	)
}

export function mcpUrl(origin: string): string {
	return `${origin}/api/mcp`
}

export function AgentSetup({ origin }: { origin: string }) {
	const url = mcpUrl(origin)
	const cursor = JSON.stringify({ mcpServers: { diffcast: { url } } }, null, 2)
	return (
		<div className="space-y-5 text-sm">
			<div className="space-y-2">
				<h3 className="font-medium">Claude Code</h3>
				<Snippet
					label="Claude Code command"
					value={`claude mcp add --transport http diffcast ${url}`}
				/>
				<p className="text-muted">
					Then run <code className="font-mono text-xs text-fg">/mcp</code> in Claude Code and choose
					Authenticate.
				</p>
			</div>
			<div className="space-y-2">
				<h3 className="font-medium">Cursor</h3>
				<p className="text-muted">
					Add this to <code className="font-mono text-xs text-fg">.cursor/mcp.json</code> (or the
					global ~/.cursor/mcp.json), then press Connect next to Diffcast in Cursor’s MCP settings.
				</p>
				<Snippet label="Cursor configuration" value={cursor} />
			</div>
			<div className="space-y-2">
				<h3 className="font-medium">Claude desktop and claude.ai</h3>
				<p className="text-muted">
					Settings, Connectors, Add custom connector. Name it Diffcast and paste the URL.
				</p>
				<Snippet label="MCP server URL" value={url} />
			</div>
			<p className="text-muted">
				Each one opens Diffcast in your browser once to ask for your permission.
			</p>
		</div>
	)
}
