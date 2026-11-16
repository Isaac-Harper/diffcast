import { cookies } from 'next/headers'
import { RETURN_COOKIE, RETURN_COOKIE_SECONDS, safeReturnPath } from '@/lib/return-path'

export async function GET(request: Request): Promise<Response> {
	const next = safeReturnPath(new URL(request.url).searchParams.get('next')) ?? '/account'
	;(await cookies()).set(RETURN_COOKIE, next, {
		httpOnly: true,
		secure: process.env['NODE_ENV'] === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: RETURN_COOKIE_SECONDS,
	})
	return new Response(null, {
		status: 303,
		headers: { location: `/signin?next=${encodeURIComponent(next)}`, 'cache-control': 'no-store' },
	})
}
