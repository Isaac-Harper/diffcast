const MAX_KEYS = 10_000

export class Throttle {
	private readonly counts = new Map<string, { count: number; resetAt: number }>()
	private readonly max: number
	private readonly windowMs: number

	constructor(max: number, windowMs: number) {
		this.max = max
		this.windowMs = windowMs
	}

	private current(key: string, now: number) {
		const record = this.counts.get(key)
		if (record && record.resetAt <= now) {
			this.counts.delete(key)
			return undefined
		}
		return record
	}

	blocked(key: string, now: number = Date.now()): boolean {
		return (this.current(key, now)?.count ?? 0) >= this.max
	}

	add(key: string, now: number = Date.now()): void {
		if (this.counts.size >= MAX_KEYS) {
			for (const [entry, record] of this.counts) {
				if (record.resetAt <= now) this.counts.delete(entry)
			}
			if (this.counts.size >= MAX_KEYS) this.counts.clear()
		}
		const record = this.current(key, now) ?? { count: 0, resetAt: now + this.windowMs }
		this.counts.set(key, { ...record, count: record.count + 1 })
	}

	clear(key?: string): void {
		if (key === undefined) this.counts.clear()
		else this.counts.delete(key)
	}
}

export function forwardedIp(forwardedFor: string | null): string {
	return forwardedFor?.split(',')[0]?.trim() || 'unknown'
}

export function requestIp(request: Request): string {
	return forwardedIp(request.headers.get('x-forwarded-for'))
}

export function pause(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds)
	})
}
