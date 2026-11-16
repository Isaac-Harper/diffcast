import { describe, expect, it } from 'vitest'
import { gatewayCostUsd, sumCostUsd } from './gateway-cost.ts'

describe('gatewayCostUsd', () => {
	it('reads the billed cost the gateway reports as a string', () => {
		expect(gatewayCostUsd({ gateway: { cost: '0.01065425', marketCost: '0.01065425' } })).toBe(
			0.01065425
		)
	})

	it('throws when the gateway reported no cost', () => {
		expect(() => gatewayCostUsd(undefined)).toThrow('gateway reported no cost')
		expect(() => gatewayCostUsd({ vertex: {} })).toThrow('gateway reported no cost')
		expect(() => gatewayCostUsd({ gateway: { cost: 'n/a' } })).toThrow('gateway reported no cost')
	})
})

describe('sumCostUsd', () => {
	it('sums steps and rounds to a millionth of a dollar', () => {
		expect(sumCostUsd([{ gateway: { cost: '0.1000004' } }, { gateway: { cost: '0.2' } }])).toBe(0.3)
	})
})
