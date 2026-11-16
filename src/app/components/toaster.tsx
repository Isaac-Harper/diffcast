'use client'

import { Toast, ToastDescription, ToastRegion, ToastTitle } from '@ui-sdk/react/toast'

export function Toaster() {
	return (
		<ToastRegion data-agent-hidden="">
			{() => (
				<Toast>
					<ToastTitle />
					<ToastDescription />
				</Toast>
			)}
		</ToastRegion>
	)
}
