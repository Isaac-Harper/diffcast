export const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
	'access-control-max-age': '86400',
}

export function oauthJson(
	body: unknown,
	status: number = 200,
	cache: string = 'no-store'
): Response {
	return Response.json(body, {
		status,
		headers: { ...CORS_HEADERS, 'cache-control': cache, pragma: 'no-cache' },
	})
}

export function oauthError(error: string, description: string, status: number = 400): Response {
	return oauthJson({ error, error_description: description }, status)
}

export function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function readForm(request: Request): Promise<URLSearchParams | null> {
	const type = request.headers.get('content-type') ?? ''
	if (!type.toLowerCase().startsWith('application/x-www-form-urlencoded')) return null
	return new URLSearchParams(await request.text())
}
