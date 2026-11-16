export type ModelPrice = {
	inputPerMillion: number
	outputPerMillion: number
	cacheReadPerMillion: number
	cacheWritePerMillion: number
}

export const MODEL_PRICES_USD: Record<string, ModelPrice> = {
	'claude-sonnet-5-5': {
		inputPerMillion: 2,
		outputPerMillion: 10,
		cacheReadPerMillion: 0.1,
		cacheWritePerMillion: 2.5,
	},
	'claude-sonnet-5': {
		inputPerMillion: 2,
		outputPerMillion: 10,
		cacheReadPerMillion: 0.2,
		cacheWritePerMillion: 2.5,
	},
	'claude-opus-5-5': {
		inputPerMillion: 4,
		outputPerMillion: 20,
		cacheReadPerMillion: 0.2,
		cacheWritePerMillion: 5,
	},
	'claude-opus-4-8': {
		inputPerMillion: 5,
		outputPerMillion: 25,
		cacheReadPerMillion: 0.5,
		cacheWritePerMillion: 6.25,
	},
}

export const WEB_SEARCH_USD_PER_THOUSAND = 10

export type ResearchUsage = {
	model: string
	inputTokens: number
	outputTokens: number
	cacheReadTokens: number
	cacheWriteTokens: number
	webSearches: number
	webFetches: number
}

export function priceFor(model: string): ModelPrice {
	const price = MODEL_PRICES_USD[model.replace(/^anthropic\//, '')]
	if (!price) throw new Error(`no price for model ${model}; add it to pricing.ts`)
	return price
}

function roundUsd(amount: number): number {
	return Math.round(amount * 1_000_000) / 1_000_000
}

export function llmCostUsd(usages: ResearchUsage[]): number {
	let total = 0
	for (const usage of usages) {
		const price = priceFor(usage.model)
		total +=
			(usage.inputTokens * price.inputPerMillion +
				usage.outputTokens * price.outputPerMillion +
				usage.cacheReadTokens * price.cacheReadPerMillion +
				usage.cacheWriteTokens * price.cacheWritePerMillion) /
				1_000_000 +
			(usage.webSearches * WEB_SEARCH_USD_PER_THOUSAND) / 1000
	}
	return roundUsd(total)
}

export function ttsCostUsd(characters: number, usdPerThousandCharacters: number): number {
	return roundUsd((characters * usdPerThousandCharacters) / 1000)
}
