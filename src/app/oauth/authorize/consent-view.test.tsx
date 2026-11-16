// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AuthorizeRequest } from '@/lib/oauth/authorize-request'
import { ConsentView } from './consent-view'

const base: AuthorizeRequest = {
	clientId: 'dc_1',
	clientName: 'Claude Code',
	clientKind: 'registered',
	redirectUri: 'https://evil.example/cb',
	state: null,
	codeChallenge: 'c'.repeat(43),
	resource: 'https://diffcast.fm/api/mcp',
	scope: 'diffcast',
}

async function decide(): Promise<void> {}

describe('ConsentView', () => {
	it('marks a registered client name as self declared and shows the redirect host prominently', () => {
		render(<ConsentView request={base} email="ana@example.com" query="" decide={decide} />)
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Connect an agent?')
		expect(document.body.textContent).toContain('An agent that calls itself “Claude Code”')
		expect(document.body.textContent).toContain('Diffcast cannot confirm that name')
		const host = screen.getByText('evil.example')
		expect(host.className).toContain('text-xl')
		expect(screen.queryByRole('note')).toBeNull()
	})

	it('names a metadata document client with its publishing domain', () => {
		render(
			<ConsentView
				request={{
					...base,
					clientId: 'https://claude.ai/oauth/mcp-client.json',
					clientName: 'Claude',
					clientKind: 'metadata_document',
					redirectUri: 'https://claude.ai/api/mcp/auth_callback',
				}}
				email="ana@example.com"
				query=""
				decide={decide}
			/>
		)
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Connect Claude?')
		expect(document.body.textContent).toContain('published by claude.ai')
		expect(document.body.textContent).not.toContain('calls itself')
	})

	it('warns for loopback and app callbacks', () => {
		render(
			<ConsentView
				request={{ ...base, redirectUri: 'cursor://anysphere.cursor-mcp/oauth/callback' }}
				email={null}
				query=""
				decide={decide}
			/>
		)
		expect(screen.getByRole('note').textContent).toContain('runs on your own computer')
		expect(screen.getByText('the Cursor app on this computer')).toBeTruthy()
	})
})
