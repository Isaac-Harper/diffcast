import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { JOB_PATH_PREFIX, checkJobRequest } from '@/lib/job-auth'
import { authConfig, SESSION_COOKIE, verifySession } from '@/lib/session'

const ADMIN = /^\/(admin|api\/admin)(\/|$)/

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	if (pathname.startsWith(JOB_PATH_PREFIX)) {
		return (await checkJobRequest(request)) ?? NextResponse.next()
	}

	if (!ADMIN.test(pathname)) return NextResponse.next()

	const token = request.cookies.get(SESSION_COOKIE)?.value
	if (verifySession(token, authConfig()?.signingKey)) return NextResponse.next()

	if (pathname.startsWith('/api/')) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
	matcher: ['/admin/:path*', '/admin', '/api/admin/:path*', '/api/jobs/:path*'],
}
