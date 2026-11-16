import { requestOrigin } from '@/lib/http'
import { corsPreflight, oauthError, oauthJson, readForm } from '@/lib/oauth/responses'
import { tokenAttempts } from '@/lib/oauth/throttles'
import { tokenRequest } from '@/lib/oauth/token-service'
import { requestIp } from '@/lib/throttle'

export async function POST(request: Request): Promise<Response> {
	const ip = requestIp(request)
	if (tokenAttempts.blocked(ip)) return oauthError('slow_down', 'Too many token requests.', 429)
	tokenAttempts.add(ip)
	const form = await readForm(request)
	if (!form) return oauthError('invalid_request', 'Send an application/x-www-form-urlencoded body.')
	const outcome = await tokenRequest(form, requestOrigin(request.headers))
	if (!outcome.ok) return oauthError(outcome.error, outcome.description, outcome.status)
	return oauthJson(outcome.body)
}

export function OPTIONS(): Response {
	return corsPreflight()
}
