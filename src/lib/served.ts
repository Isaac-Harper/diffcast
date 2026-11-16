export const SERVED_STATUSES = ['active', 'past_due'] as const

export interface Billing {
	active: boolean
	comped: boolean
	subscription_status: string | null
}

export type Plan = 'comped' | 'active' | 'past_due' | 'canceled' | 'none'

export function isServed(listener: Billing): boolean {
	return (
		listener.active &&
		(listener.comped ||
			(SERVED_STATUSES as readonly string[]).includes(listener.subscription_status ?? ''))
	)
}

export function planOf(listener: Omit<Billing, 'active'>): Plan {
	if (listener.comped) return 'comped'
	const status = listener.subscription_status
	if (status === null) return 'none'
	if (status === 'active' || status === 'past_due') return status
	return 'canceled'
}

export const PLAN_LABELS: Record<Plan, string> = {
	comped: 'Comped',
	active: 'Active',
	past_due: 'Past due',
	canceled: 'Canceled',
	none: 'No plan',
}
