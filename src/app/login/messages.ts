const ERRORS: Record<string, string> = {
	invalid: 'Wrong password.',
	throttled: 'Too many attempts. Wait ten minutes and try again.',
}

export function loginMessage(error: string | undefined): string | undefined {
	return error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined
}
