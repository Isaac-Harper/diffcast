import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { requestOrigin } from '@/lib/http'
import { registerDiffcastTools } from '@/lib/mcp/server'
import { PROTECTED_RESOURCE_PATH, SCOPE } from '@/lib/oauth/metadata'
import { mcpCalls } from '@/lib/oauth/throttles'
import { diffcastAuth, verifyAccessToken } from '@/lib/oauth/verify-access'

async function serve(request: Request): Promise<Response> {
	const { grantId } = diffcastAuth(request.auth)
	const key = `grant:${grantId}`
	if (mcpCalls.blocked(key)) {
		return Response.json(
			{ error: 'rate_limited', error_description: 'Too many requests. Slow down.' },
			{ status: 429, headers: { 'retry-after': '60' } }
		)
	}
	mcpCalls.add(key)
	const origin = requestOrigin(request.headers)
	const handler = createMcpHandler((server) => registerDiffcastTools(server, origin), {
		serverInfo: { name: 'diffcast', version: '1.0.0' },
		instructions:
			'Diffcast makes a private daily tech news podcast for this developer. Call push_context when the work changes (new project, new packages, a new problem area) so tomorrow’s episode follows it. Never send secrets, code or private client names.',
	})
	return handler(request)
}

const authed = withMcpAuth(
	serve,
	(request, token) => verifyAccessToken(token, requestOrigin(request.headers)),
	{ required: true, requiredScopes: [SCOPE], resourceMetadataPath: PROTECTED_RESOURCE_PATH }
)

export { authed as DELETE, authed as GET, authed as POST }
