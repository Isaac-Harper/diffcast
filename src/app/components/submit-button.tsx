'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

export function SubmitButton({
	children,
	primary = false,
	name,
	value,
}: {
	children: ReactNode
	primary?: boolean
	name?: string
	value?: string
}) {
	const { pending } = useFormStatus()
	return (
		<button
			type="submit"
			name={name}
			value={value}
			disabled={pending}
			className={primary ? 'btn btn-primary' : 'btn'}
		>
			{children}
		</button>
	)
}
