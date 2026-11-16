export function sleep(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function jitter(milliseconds: number): number {
	return Math.round(milliseconds * (0.5 + Math.random() * 0.5))
}
