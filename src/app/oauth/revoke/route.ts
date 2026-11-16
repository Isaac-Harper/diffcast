import { corsPreflight, oauthError, readForm } from '@/lib/oauth/responses'
import { CORS_HEADERS } from '@/lib/oauth/responses'
import { revocationRequest } from '@/lib/oauth/token-service'

export async function POST(request: Request): Promise<Response> {
	const form = await readForm(request)
	if (!form) return oauthError('invalid_request', 'Send an application/x-www-form-urlencoded body.')
	await revocationRequest(form)
	return new Response(null, {
		status: 200,
		headers: { ...CORS_HEADERS, 'cache-control': 'no-store' },
	})
}

export function OPTIONS(): Response {
	return corsPreflight()
}
