'use client'

import { Button } from '@ui-sdk/react/button'
import { useState } from 'react'

export function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false)

	async function copy() {
		await navigator.clipboard.writeText(value)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}

	return (
		<Button onClick={copy} className="shrink-0">
			<span aria-live="polite">
				{copied ? 'Copied' : 'Copy'}
				<span className="sr-only"> {label}</span>
			</span>
		</Button>
	)
}
