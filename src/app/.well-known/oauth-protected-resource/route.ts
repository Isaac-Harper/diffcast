import { requestOrigin } from '@/lib/http'
import { protectedResourceMetadata } from '@/lib/oauth/metadata'
import { corsPreflight, oauthJson } from '@/lib/oauth/responses'

export function GET(request: Request): Response {
	return oauthJson(
		protectedResourceMetadata(requestOrigin(request.headers)),
		200,
		'public, max-age=3600'
	)
}

export function OPTIONS(): Response {
	return corsPreflight()
}
