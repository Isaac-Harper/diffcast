// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { createAgent } from '@ui-sdk/react/agent'
import { describe, expect, test, vi } from 'vitest'
import { FeedbackForm } from './forms'

vi.mock('./actions', () => ({
	submitFeedback: vi.fn(async () => ({ status: 'saved', message: 'Thanks.' })),
}))

const agent = createAgent()

function isChecked(radio: HTMLElement): boolean {
	return radio.getAttribute('aria-checked') === 'true' || (radio as HTMLInputElement).checked
}

function namedComponents() {
	return agent.snapshot().filter((entry) => !entry.offPage && entry.component !== 'more')
}

describe('FeedbackForm', () => {
	test('an agent can find and fill every control, named by episode date', async () => {
		render(
			<FeedbackForm token="abc" episodeId={7} episodeDate="Mon, Nov 16, 2026" current={null} />
		)

		const components = namedComponents()
		for (const entry of components) {
			expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
		}
		const labels = components.map((entry) => entry.label)
		for (const label of [
			'Did you listen? (Mon, Nov 16, 2026)',
			'Useful? (Mon, Nov 16, 2026)',
			'Feedback note (Mon, Nov 16, 2026)',
		]) {
			expect(labels, `${label} is missing from the snapshot`).toContain(label)
		}

		let result: Awaited<ReturnType<typeof agent.act>> | undefined
		await act(async () => {
			result = await agent.act({
				steps: [
					{ ref: 'Did you listen? (Mon, Nov 16, 2026)', action: 'setValue', args: ['partly'] },
					{ ref: 'Useful? (Mon, Nov 16, 2026)', action: 'setValue', args: ['down'] },
					{
						ref: 'Feedback note (Mon, Nov 16, 2026)',
						action: 'setValue',
						args: ['Too many releases'],
					},
				],
			})
		})
		expect(result?.ok, result?.error?.message).toBe(true)
		expect(isChecked(screen.getByRole('radio', { name: 'Partly' }))).toBe(true)
		expect(isChecked(screen.getByRole('radio', { name: 'Not useful' }))).toBe(true)
		expect(
			screen.getByLabelText<HTMLTextAreaElement>('Feedback note (Mon, Nov 16, 2026)').value
		).toBe('Too many releases')
		expect((document.querySelector('input[name="episodeId"]') as HTMLInputElement).value).toBe('7')
	})
})
