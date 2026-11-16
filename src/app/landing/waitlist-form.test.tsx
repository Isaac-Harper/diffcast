// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAgent } from '@ui-sdk/react/agent'
import { beforeEach, expect, test, vi } from 'vitest'
import { WaitlistForm } from './waitlist-form'

const joinWaitlist = vi.hoisted(() => vi.fn())
vi.mock('../waitlist/actions', () => ({ joinWaitlist }))

const agent = createAgent()

beforeEach(() => {
	joinWaitlist.mockReset()
})

test('an agent can find and fill every control', async () => {
	render(<WaitlistForm />)

	const components = agent
		.snapshot()
		.filter((entry) => !entry.offPage && entry.component !== 'more')
	for (const entry of components) {
		expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
	}
	const labels = components.map((entry) => entry.label)
	for (const label of [
		'Email',
		'What do you want to hear about? (optional)',
		'Podcast app (optional)',
		'Your stack (optional)',
		'Request an invite',
	]) {
		expect(labels, `${label} is missing from the snapshot`).toContain(label)
	}

	let result: Awaited<ReturnType<typeof agent.act>> | undefined
	await act(async () => {
		result = await agent.act({
			steps: [
				{ ref: 'Email', action: 'setValue', args: ['ana@example.com'] },
				{
					ref: 'What do you want to hear about? (optional)',
					action: 'setValue',
					args: ['AI agents and security'],
				},
				{ ref: 'Podcast app (optional)', action: 'setValue', args: ['Overcast'] },
				{ ref: 'Your stack (optional)', action: 'setValue', args: ['npm:next'] },
			],
		})
	})
	expect(result?.ok, result?.error?.message).toBe(true)
	expect(screen.getByLabelText<HTMLInputElement>('Email').value).toBe('ana@example.com')
	expect(
		screen.getByLabelText<HTMLTextAreaElement>('What do you want to hear about? (optional)').value
	).toBe('AI agents and security')
	expect(screen.getByLabelText<HTMLTextAreaElement>('Your stack (optional)').value).toBe('npm:next')
	expect(
		document.querySelector<HTMLInputElement | HTMLSelectElement>('[name="podcastApp"]')?.value
	).toBe('Overcast')
})

test('submits the typed values, keeps them on an error and confirms a join', async () => {
	joinWaitlist.mockResolvedValueOnce({ status: 'error', message: 'Enter a valid email address.' })
	joinWaitlist.mockResolvedValueOnce({ status: 'joined', message: 'On the list.' })
	const user = userEvent.setup()
	render(<WaitlistForm />)

	await user.type(screen.getByLabelText('Email'), 'ana@example.com')
	await user.click(screen.getByRole('button', { name: 'Request an invite' }))

	expect((await screen.findByRole('alert')).textContent).toBe('Enter a valid email address.')
	const form = joinWaitlist.mock.calls[0]?.[1] as FormData
	expect(form.get('email')).toBe('ana@example.com')
	expect(form.get('website')).toBe('')
	expect(screen.getByLabelText<HTMLInputElement>('Email').value).toBe('ana@example.com')

	await user.click(screen.getByRole('button', { name: 'Request an invite' }))
	expect((await screen.findByRole('status')).textContent).toContain('on the list')
	expect(screen.queryByLabelText('Email')).toBeNull()
})

test('the email field is required and the honeypot is out of reach', () => {
	render(<WaitlistForm />)
	expect(screen.getByLabelText<HTMLInputElement>('Email').required).toBe(true)
	const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]')
	expect(honeypot?.tabIndex).toBe(-1)
	expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull()
})
