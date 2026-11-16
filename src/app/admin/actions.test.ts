import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE, signingKey, signSession } from '@/lib/session'
import { saveCheck } from './episodes/actions'
import {
	issueToken,
	previewStack,
	revokeToken,
	saveListener,
	toggleListener,
} from './listeners/actions'

const state = vi.hoisted(() => ({
	session: undefined as string | undefined,
	writes: [] as string[],
}))

vi.mock('@/lib/db', () => ({
	sql: () => {
		throw new Error('The database must not be used in this test')
	},
}))
vi.mock('next/cache', () => ({ refresh: () => undefined }))
vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === SESSION_COOKIE && state.session ? { name, value: state.session } : undefined,
	}),
	headers: async () => new Headers({ host: 'diffcast.test', 'x-forwarded-proto': 'https' }),
}))
vi.mock('@/lib/store/listeners', () => ({
	listenerExists: async () => true,
	addListener: async () => {
		state.writes.push('addListener')
		return 1
	},
	updateListener: async () => {
		state.writes.push('updateListener')
	},
	setListenerActive: async () => {
		state.writes.push('setListenerActive')
	},
}))
vi.mock('@/lib/store/interests', () => ({
	saveInterests: async (listenerId: number, rows: { topic: string; active: boolean }[]) => {
		state.writes.push(
			`saveInterests:${listenerId}:${rows.map((row) => `${row.topic}=${row.active}`).join(',')}`
		)
	},
}))
vi.mock('@/lib/store/waitlist', () => ({
	markWaitlistInvited: async (id: number) => {
		state.writes.push(`markWaitlistInvited:${id}`)
	},
}))
vi.mock('@/lib/store/feed-tokens', () => ({
	addFeedToken: async () => {
		state.writes.push('addFeedToken')
	},
	revokeFeedToken: async () => {
		state.writes.push('revokeFeedToken')
	},
}))
vi.mock('@/lib/store/episodes', () => ({
	getEpisode: async () => ({ segments: [{}] }),
}))
vi.mock('@/lib/store/feedback', () => ({
	saveSegmentCheck: async () => {
		state.writes.push('saveSegmentCheck')
	},
}))

const SECRET = 's'.repeat(40)
const PASSWORD = 'owner-password'

function form(values: Record<string, string>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) data.set(key, value)
	return data
}

const calls: [string, () => Promise<unknown>][] = [
	[
		'saveListener',
		() =>
			saveListener(
				{ error: null },
				form({ name: 'Ana', timezone: 'UTC', minutes: '10', days: '1' })
			),
	],
	['previewStack', () => previewStack('next', 'lines')],
	['toggleListener', () => toggleListener(form({ id: '1', active: 'false' }))],
	[
		'issueToken',
		() => issueToken({ status: 'idle' }, form({ listenerId: '1', label: 'Overcast' })),
	],
	['revokeToken', () => revokeToken(form({ tokenId: '1' }))],
	[
		'saveCheck',
		() =>
			saveCheck(
				{ status: 'idle', message: '' },
				form({ episodeId: '1', segmentIndex: '0', verdict: 'correct' })
			),
	],
]

beforeEach(() => {
	vi.stubEnv('DIFFCAST_ADMIN_PASSWORD', PASSWORD)
	vi.stubEnv('DIFFCAST_SESSION_SECRET', SECRET)
	state.session = undefined
	state.writes.length = 0
})

describe('admin actions', () => {
	it('redirect to /login and write nothing without a valid session', async () => {
		for (const session of [undefined, 'forged.token', signSession(signingKey(SECRET, 'old'))]) {
			state.session = session
			for (const [name, call] of calls) {
				await expect(call(), `${name} ${session}`).rejects.toMatchObject({
					digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/login/),
				})
			}
		}
		expect(state.writes).toEqual([])
	})

	it('run with a valid session', async () => {
		state.session = signSession(signingKey(SECRET, PASSWORD))
		expect(await previewStack('npm:next', 'lines')).toEqual({
			ok: true,
			dependencies: [{ name: 'next', ecosystem: 'npm' }],
		})
		const issued = await issueToken(
			{ status: 'idle' },
			form({ listenerId: '1', label: 'Overcast' })
		)
		expect(issued).toMatchObject({ status: 'issued' })
		await toggleListener(form({ id: '1', active: 'false' }))
		await revokeToken(form({ tokenId: '1' }))
		expect(state.writes).toEqual(['addFeedToken', 'setListenerActive', 'revokeFeedToken'])
	})

	it('stamps the waitlist entry when a listener is created from it', async () => {
		state.session = signSession(signingKey(SECRET, PASSWORD))
		await expect(
			saveListener(
				{ error: null },
				form({ name: 'Ana', timezone: 'UTC', minutes: '10', days: '1', waitlistId: '7' })
			)
		).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/admin\/listeners\/1/),
		})
		expect(state.writes).toEqual(['addListener', 'markWaitlistInvited:7'])
	})

	it('does not stamp the waitlist without a session', async () => {
		await expect(
			saveListener(
				{ error: null },
				form({ name: 'Ana', timezone: 'UTC', minutes: '10', days: '1', waitlistId: '7' })
			)
		).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/login/) })
		expect(state.writes).toEqual([])
	})

	function interestsForm(values: Record<string, string>): FormData {
		const data = form({ name: 'Ana', timezone: 'UTC', minutes: '10', days: '1', ...values })
		data.set('interestsEditor', '1')
		for (const [topic, active] of [
			['Security', 'true'],
			['Databases', 'false'],
		] as const) {
			data.append('topic[]', topic)
			data.append('take[]', '')
			data.append('note[]', '')
			data.append('active[]', active)
		}
		return data
	}

	it('saves posted interests with the listener, in order, only with a session', async () => {
		await expect(saveListener({ error: null }, interestsForm({ id: '1' }))).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/login/),
		})
		expect(state.writes).toEqual([])

		state.session = signSession(signingKey(SECRET, PASSWORD))
		await expect(saveListener({ error: null }, interestsForm({ id: '1' }))).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/admin\/listeners\/1\?saved=1/),
		})
		await expect(saveListener({ error: null }, interestsForm({}))).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/admin\/listeners\/1/),
		})
		expect(state.writes).toEqual([
			'updateListener',
			'saveInterests:1:Security=true,Databases=false',
			'addListener',
			'saveInterests:1:Security=true,Databases=false',
		])
	})

	it('leaves interests alone without the editor and refuses an empty editor', async () => {
		state.session = signSession(signingKey(SECRET, PASSWORD))
		await expect(
			saveListener(
				{ error: null },
				form({ id: '1', name: 'Ana', timezone: 'UTC', minutes: '10', days: '1' })
			)
		).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) })
		expect(state.writes).toEqual(['updateListener'])

		const empty = form({
			id: '1',
			name: 'Ana',
			timezone: 'UTC',
			minutes: '10',
			days: '1',
			interestsEditor: '1',
		})
		expect(await saveListener({ error: null }, empty)).toEqual({
			error: 'Keep at least one interest.',
		})
		expect(state.writes).toEqual(['updateListener'])
	})
})
