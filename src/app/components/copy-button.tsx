'use client'

import { useState } from 'react'

export function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false)

	async function copy() {
		await navigator.clipboard.writeText(value)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}

	return (
		<button type="button" onClick={copy} className="btn shrink-0" aria-label={`Copy ${label}`}>
			{copied ? 'Copied' : 'Copy'}
		</button>
	)
}
