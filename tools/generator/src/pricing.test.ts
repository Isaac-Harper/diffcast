import { describe, expect, it } from 'vitest'
import { llmCostUsd, priceFor, ttsCostUsd } from './pricing.ts'
import type { ResearchUsage } from './pricing.ts'

const usage: ResearchUsage = {
	model: 'claude-sonnet-5-5',
	inputTokens: 100_000,
	outputTokens: 10_000,
	cacheReadTokens: 200_000,
	cacheWriteTokens: 40_000,
	webSearches: 12,
	webFetches: 9,
}

describe('llmCostUsd', () => {
	it('prices tokens, cache and searches, with fetches free', () => {
		expect(llmCostUsd([usage])).toBeCloseTo(0.2 + 0.1 + 0.02 + 0.1 + 0.12, 6)
	})

	it('sums requests priced by the model that served each one', () => {
		const fallback = { ...usage, model: 'claude-opus-4-8', webSearches: 0 }
		expect(llmCostUsd([usage, fallback])).toBeCloseTo(0.54 + 0.5 + 0.25 + 0.1 + 0.25, 6)
	})

	it('throws for a model with no price', () => {
		expect(() => priceFor('claude-unknown')).toThrow('no price for model claude-unknown')
	})
})

describe('ttsCostUsd', () => {
	it('prices characters per thousand', () => {
		expect(ttsCostUsd(12_345, 0.3)).toBeCloseTo(3.7035, 6)
		expect(ttsCostUsd(0, 0.3)).toBe(0)
	})
})
