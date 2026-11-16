import type { ProviderMetadata } from 'ai'

export type StageUsage = {
	model: string
	inputTokens: number
	outputTokens: number
	costUsd: number
}

export function gatewayCostUsd(providerMetadata: ProviderMetadata | undefined): number {
	const cost = providerMetadata?.['gateway']?.['cost']
	const amount = typeof cost === 'string' || typeof cost === 'number' ? Number(cost) : Number.NaN
	if (!Number.isFinite(amount) || amount < 0) {
		throw new Error(`gateway reported no cost (got ${JSON.stringify(cost)})`)
	}
	return amount
}

export function sumCostUsd(metadata: (ProviderMetadata | undefined)[]): number {
	return roundUsd(metadata.reduce((total, entry) => total + gatewayCostUsd(entry), 0))
}

export function roundUsd(amount: number): number {
	return Math.round(amount * 1_000_000) / 1_000_000
}
