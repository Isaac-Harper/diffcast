'use client'

import { Button } from '@ui-sdk/react/button'
import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

export type ButtonVariant = 'solid' | 'destructive' | 'quiet'

export function SubmitButton({
	children,
	variant,
	size,
	name,
	value,
}: {
	children: ReactNode
	variant?: ButtonVariant
	size?: 'lg'
	name?: string
	value?: string
}) {
	const { pending } = useFormStatus()
	return (
		<Button
			type="submit"
			name={name}
			value={value}
			disabled={pending}
			focusableWhenDisabled
			data-variant={variant}
			data-size={size}
		>
			{children}
		</Button>
	)
}
