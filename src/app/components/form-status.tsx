export function FormStatus({
	status,
	message,
}: {
	status: 'idle' | 'saved' | 'joined' | 'error'
	message: string
}) {
	if (status === 'idle') return null
	return (
		<p
			role={status === 'error' ? 'alert' : 'status'}
			className={status === 'error' ? 'text-sm text-del' : 'text-sm text-add'}
		>
			{message}
		</p>
	)
}
