import { randomUUID } from 'node:crypto'
import { readJson } from '@/lib/http'
import { parseClientMetadata } from '@/lib/oauth/client-metadata'
import { corsPreflight, oauthError, oauthJson } from '@/lib/oauth/responses'
import { registrations } from '@/lib/oauth/throttles'
import { addRegisteredClient } from '@/lib/store/oauth'
import { requestIp } from '@/lib/throttle'

export async function POST(request: Request): Promise<Response> {
	const ip = requestIp(request)
	if (registrations.blocked(ip)) {
		return oauthError(
			'slow_down',
			'Too many registrations from this address. Try again later.',
			429
		)
	}
	registrations.add(ip)
	const json = await readJson(request)
	if (!json.ok) return oauthError('invalid_client_metadata', 'Send a JSON body.')
	const parsed = parseClientMetadata(json.body, { requireName: false })
	if (!parsed.ok) return oauthError(parsed.error, parsed.description)
	const clientId = `dc_${randomUUID()}`
	await addRegisteredClient(clientId, parsed.client.name, parsed.client.redirectUris)
	return oauthJson(
		{
			client_id: clientId,
			client_id_issued_at: Math.floor(Date.now() / 1000),
			client_name: parsed.client.name,
			redirect_uris: parsed.client.redirectUris,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
		},
		201
	)
}

export function OPTIONS(): Response {
	return corsPreflight()
}
