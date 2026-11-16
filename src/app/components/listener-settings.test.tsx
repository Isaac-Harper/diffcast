// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { createAgent } from '@ui-sdk/react/agent'
import { describe, expect, test, vi } from 'vitest'
import { DaysForm } from './listener-settings'

const agent = createAgent()

describe('DaysForm', () => {
	test('an agent can find the days and change them, and the form posts each day', async () => {
		const action = vi.fn(async () => ({ status: 'saved' as const, message: 'Days saved.' }))
		render(<DaysForm action={action} hidden={{ token: 'abc' }} days={[1, 2, 3, 4, 5, 6, 7]} />)

		const components = agent
			.snapshot()
			.filter((entry) => !entry.offPage && entry.component !== 'more')
		for (const entry of components) {
			expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
		}
		expect(components.map((entry) => entry.label)).toContain('Days')

		let result: Awaited<ReturnType<typeof agent.act>> | undefined
		await act(async () => {
			result = await agent.act({ steps: [{ ref: 'Days', action: 'setValue', args: [['1', '3']] }] })
		})
		expect(result?.ok, result?.error?.message).toBe(true)
		const form = document.querySelector('form')
		if (!form) throw new Error('no form')
		const posted = new FormData(form)
		expect(posted.getAll('days')).toEqual(['1', '3'])
		expect(posted.get('token')).toBe('abc')
		expect(screen.getByRole('checkbox', { name: 'Saturday' }).getAttribute('aria-checked')).toBe(
			'false'
		)
		expect(screen.getByRole('button', { name: 'Save days' })).toBeTruthy()
	})
})
