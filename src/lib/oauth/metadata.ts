export const SCOPE = 'diffcast'
export const MCP_PATH = '/api/mcp'
export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource'

export const ACCESS_TOKEN_SECONDS = 60 * 60
export const REFRESH_TOKEN_SECONDS = 60 * 24 * 60 * 60
export const CODE_SECONDS = 10 * 60

export function resourceFor(origin: string): string {
	return `${origin}${MCP_PATH}`
}

export function protectedResourceMetadataUrl(origin: string): string {
	return `${origin}${PROTECTED_RESOURCE_PATH}`
}

export function protectedResourceMetadata(origin: string) {
	return {
		resource: resourceFor(origin),
		authorization_servers: [origin],
		scopes_supported: [SCOPE],
		bearer_methods_supported: ['header'],
		resource_name: 'Diffcast',
		resource_documentation: `${origin}/agents`,
	}
}

export function authorizationServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		registration_endpoint: `${origin}/oauth/register`,
		revocation_endpoint: `${origin}/oauth/revoke`,
		scopes_supported: [SCOPE],
		response_types_supported: ['code'],
		response_modes_supported: ['query'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none'],
		revocation_endpoint_auth_methods_supported: ['none'],
		client_id_metadata_document_supported: true,
		authorization_response_iss_parameter_supported: true,
		service_documentation: `${origin}/agents`,
	}
}

export function sameResource(candidate: string, expected: string): boolean {
	try {
		const left = new URL(candidate)
		const right = new URL(expected)
		if (left.hash || left.search) return false
		const trim = (url: URL) => url.pathname.replace(/\/+$/, '') || '/'
		return left.origin === right.origin && trim(left) === trim(right)
	} catch {
		return false
	}
}
