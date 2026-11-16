import type { z } from 'zod'

export async function readJson(
	request: Request
): Promise<{ ok: true; body: unknown } | { ok: false }> {
	try {
		return { ok: true, body: await request.json() }
	} catch {
		return { ok: false }
	}
}

export function badJson(): Response {
	return Response.json({ error: 'Send a JSON body.' }, { status: 400 })
}

export function invalidBody(error: z.ZodError): Response {
	return Response.json({ error: 'Invalid body.', issues: error.issues }, { status: 400 })
}

export function requestOrigin(headerList: Headers): string {
	const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
	if (!host) throw new Error('Request has no host header')
	const proto =
		headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
	return `${proto}://${host}`
}
