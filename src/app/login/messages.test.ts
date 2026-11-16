import { describe, expect, it } from 'vitest'
import { loginMessage } from './messages'

describe('login messages', () => {
	it('maps known errors and ignores everything else, including prototype keys', () => {
		expect(loginMessage('invalid')).toBe('Wrong password.')
		expect(loginMessage('throttled')).toMatch(/Too many attempts/)
		for (const error of [undefined, '', 'nope', '__proto__', 'constructor', 'toString']) {
			expect(loginMessage(error), String(error)).toBeUndefined()
		}
	})
})
