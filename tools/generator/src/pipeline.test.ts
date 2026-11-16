import { describe, expect, it } from 'vitest'
import type { EpisodeScript } from '../../../shared/contract.ts'
import { buildMetrics } from './pipeline.ts'

describe('buildMetrics', () => {
	it('combines research, writing and speech into the contract metrics', () => {
		const episode: EpisodeScript = {
			title: 'T',
			summary: 'S',
			storyCount: 1,
			segments: [],
			turns: [
				{ speaker: 'host', text: 'abcde' },
				{ speaker: 'cohost', text: 'fghij' },
			],
		}
		const metrics = buildMetrics(
			{
				model: 'google/research',
				inputTokens: 90_000,
				outputTokens: 4_000,
				costUsd: 0.081234,
				webSearches: 9,
				webFetches: 12,
				researchSeconds: 61.27,
			},
			{
				model: 'google/writer',
				inputTokens: 12_000,
				outputTokens: 3_000,
				costUsd: 0.02,
				attempts: 1,
			},
			{ costUsd: 0.13 },
			episode
		)
		expect(metrics).toEqual({
			model: 'google/research + google/writer',
			inputTokens: 102_000,
			outputTokens: 7_000,
			webSearches: 9,
			webFetches: 12,
			ttsCharacters: 10,
			llmCostUsd: 0.101234,
			ttsCostUsd: 0.13,
			researchSeconds: 61.3,
		})
	})
})
