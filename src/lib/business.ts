export const STANDARD_PRICE_USD = 25
export const SMOKE_MODEL = 'smoke'

export interface BusinessCounts {
	served: number
	paying: number
	comped: number
	canceling: number
	endedThisWeek: number
	signupsStarted: number
	signupsCompleted: number
	episodesToday: number
	failuresToday: number
	averageCost7: number | null
	maxCost7: number | null
	episodeCost30: number
}

export interface BusinessReport extends BusinessCounts {
	mrr: number
	revenue30: number
	margin30: number
}

export function businessReport(counts: BusinessCounts): BusinessReport {
	const mrr = counts.paying * STANDARD_PRICE_USD
	return { ...counts, mrr, revenue30: mrr, margin30: mrr - counts.episodeCost30 }
}
