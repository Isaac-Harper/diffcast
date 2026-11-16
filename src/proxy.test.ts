import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jobFailures } from '@/lib/job-auth'
import { SESSION_COOKIE, signingKey, signSession } from '@/lib/session'
import { config, proxy } from './proxy'

const JOB = 'job-token-'.padEnd(48, 'j')
const SECRET = 's'.repeat(40)
const PASSWORD = 'owner-password'

function request(path: string, init: { cookie?: string; auth?: string } = {}): NextRequest {
	const headers = new Headers({ 'x-forwarded-for': '192.0.2.44' })
	if (init.cookie) headers.set('cookie', `${SESSION_COOKIE}=${init.cookie}`)
	if (init.auth) headers.set('authorization', init.auth)
	return new NextRequest(`http://localhost${path}`, { headers })
}

function passes(response: Response): boolean {
	return response.headers.get('x-middleware-next') === '1'
}

beforeEach(() => {
	vi.stubEnv('DIFFCAST_JOB_TOKEN', JOB)
	vi.stubEnv('DIFFCAST_ADMIN_PASSWORD', PASSWORD)
	vi.stubEnv('DIFFCAST_SESSION_SECRET', SECRET)
	jobFailures.clear()
})

describe('proxy', () => {
	it('sends admin pages without a valid session to /login', async () => {
		for (const cookie of [undefined, 'garbage', signSession(signingKey(SECRET, 'old-password'))]) {
			for (const path of ['/admin', '/admin/listeners/3']) {
				const response = await proxy(request(path, { cookie }))
				expect(response.status, `${path} ${cookie}`).toBe(307)
				expect(response.headers.get('location')).toBe('http://localhost/login')
			}
		}
	})

	it('answers 401 on /api/admin without a session', async () => {
		const response = await proxy(request('/api/admin/anything'))
		expect(response.status).toBe(401)
	})

	it('lets a valid session through to admin', async () => {
		const cookie = signSession(signingKey(SECRET, PASSWORD))
		expect(passes(await proxy(request('/admin', { cookie })))).toBe(true)
		expect(passes(await proxy(request('/admin/episodes/4', { cookie })))).toBe(true)
	})

	it('refuses the job API without the bearer token, even with a session', async () => {
		const cookie = signSession(signingKey(SECRET, PASSWORD))
		const responses = await Promise.all([
			proxy(request('/api/jobs/due')),
			proxy(request('/api/jobs/due', { cookie })),
			proxy(request('/api/jobs/upload', { auth: 'Bearer wrong' })),
		])
		expect(responses.map((response) => response.status)).toEqual([401, 401, 401])
		expect(passes(await proxy(request('/api/jobs/due', { auth: `Bearer ${JOB}` })))).toBe(true)
	})

	it('passes listener surfaces to their handlers', async () => {
		for (const path of ['/l/abc', '/api/feed/abc', '/api/audio/abc/1.mp3', '/login', '/']) {
			expect(passes(await proxy(request(path))), path).toBe(true)
		}
	})

	it('matches admin and job paths', () => {
		expect(config.matcher).toEqual(
			expect.arrayContaining(['/admin', '/admin/:path*', '/api/admin/:path*', '/api/jobs/:path*'])
		)
	})
})
