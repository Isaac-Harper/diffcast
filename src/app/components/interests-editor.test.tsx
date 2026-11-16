// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAgent } from '@ui-sdk/react/agent'
import { expect, test } from 'vitest'
import { parseInterestRows } from '@/lib/interests'
import { InterestsEditor } from './interests-editor'

const agent = createAgent()

const INITIAL = [
	{ topic: 'Security', take: 'Passkeys are ready', note: null, active: true },
	{ topic: 'Open source', take: null, note: null, active: true },
]

function posted() {
	const form = screen.getByTestId('form') as HTMLFormElement
	const parsed = parseInterestRows(new FormData(form))
	if (!parsed.ok) throw new Error(parsed.error)
	return parsed.input
}

function renderEditor() {
	render(
		<form data-testid="form">
			<InterestsEditor initial={INITIAL} />
		</form>
	)
}

test('posts rows the parser accepts, after reorder, toggle, add and remove', async () => {
	const user = userEvent.setup()
	renderEditor()
	expect(posted()).toEqual(INITIAL)

	await user.click(screen.getByRole('button', { name: 'Down: move Security' }))
	await user.click(screen.getByRole('switch', { name: 'Include Security' }))
	await user.click(screen.getByRole('button', { name: 'Add an interest' }))
	await user.type(screen.getByLabelText('Topic 3'), 'Databases')
	await user.type(screen.getByLabelText(/Note on Databases/), 'Postgres only')
	expect(posted()).toEqual([
		{ topic: 'Open source', take: null, note: null, active: true },
		{ topic: 'Security', take: 'Passkeys are ready', note: null, active: false },
		{ topic: 'Databases', take: null, note: 'Postgres only', active: true },
	])

	await user.click(screen.getByRole('button', { name: 'Remove Open source' }))
	expect(posted().map((row) => row.topic)).toEqual(['Security', 'Databases'])
	expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('interestsEditor')).toBe(
		'1'
	)
})

test('the first row cannot move up and the last cannot move down', () => {
	renderEditor()
	const up = screen.getByRole('button', { name: 'Up: move Security' })
	const down = screen.getByRole('button', { name: 'Down: move Open source' })
	expect(up.hasAttribute('disabled') || up.getAttribute('aria-disabled') === 'true').toBe(true)
	expect(down.hasAttribute('disabled') || down.getAttribute('aria-disabled') === 'true').toBe(true)
	expect(screen.getByRole('button', { name: 'Down: move Security' }).hasAttribute('disabled')).toBe(
		false
	)
})

test('an agent can find and change every control', async () => {
	renderEditor()
	const components = agent
		.snapshot()
		.filter((entry) => !entry.offPage && entry.component !== 'more')
	for (const entry of components) {
		expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
	}
	const labels = components.map((entry) => entry.label)
	for (const label of ['Topic 1', 'Include Security', 'Add an interest']) {
		expect(labels, `${label} is missing from the snapshot`).toContain(label)
	}
	expect(labels.some((label) => label?.startsWith('Take on Security'))).toBe(true)

	let result: Awaited<ReturnType<typeof agent.act>> | undefined
	await act(async () => {
		result = await agent.act({
			steps: [{ ref: 'Topic 2', action: 'setValue', args: ['Open source tooling'] }],
		})
	})
	expect(result?.ok, result?.error?.message).toBe(true)
	expect(posted()[1]?.topic).toBe('Open source tooling')
})
