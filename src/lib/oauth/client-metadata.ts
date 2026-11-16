import { isAllowedRedirectUri, isAppCallback, MAX_REDIRECT_URIS } from './redirect-uris'

export const MAX_CLIENT_NAME = 200
export const DEFAULT_CLIENT_NAME = 'An unnamed agent'

export interface ClientMetadata {
	name: string
	redirectUris: string[]
}

export type MetadataResult =
	| { ok: true; client: ClientMetadata }
	| { ok: false; error: 'invalid_redirect_uri' | 'invalid_client_metadata'; description: string }

function invalid(description: string): MetadataResult {
	return { ok: false, error: 'invalid_client_metadata', description }
}

function stringArray(value: unknown): string[] | null {
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return null
	return value
}

export function parseClientMetadata(
	body: unknown,
	{ requireName, allowAppCallbacks }: { requireName: boolean; allowAppCallbacks: boolean }
): MetadataResult {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return invalid('Send a JSON object.')
	}
	const record = body as Record<string, unknown>
	const redirectUris = stringArray(record['redirect_uris'])
	if (!redirectUris || redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
		return {
			ok: false,
			error: 'invalid_redirect_uri',
			description: `redirect_uris must list 1 to ${MAX_REDIRECT_URIS} uris.`,
		}
	}
	const badUri = redirectUris.find(
		(uri) => !isAllowedRedirectUri(uri) && !(allowAppCallbacks && isAppCallback(uri))
	)
	if (badUri !== undefined) {
		return {
			ok: false,
			error: 'invalid_redirect_uri',
			description:
				'Redirect uris must be https, or http on localhost or 127.0.0.1, with no fragment.',
		}
	}
	const authMethod = record['token_endpoint_auth_method']
	if (authMethod !== undefined && authMethod !== 'none') {
		return invalid('Only public clients are supported: token_endpoint_auth_method must be none.')
	}
	const grantTypes = record['grant_types']
	if (grantTypes !== undefined) {
		const grants = stringArray(grantTypes)
		if (
			!grants ||
			!grants.includes('authorization_code') ||
			grants.some((grant) => grant !== 'authorization_code' && grant !== 'refresh_token')
		) {
			return invalid('grant_types may only be authorization_code and refresh_token.')
		}
	}
	const responseTypes = record['response_types']
	if (responseTypes !== undefined) {
		const types = stringArray(responseTypes)
		if (!types || types.length === 0 || types.some((type) => type !== 'code')) {
			return invalid('response_types may only be code.')
		}
	}
	const rawName = record['client_name']
	if (rawName !== undefined && typeof rawName !== 'string')
		return invalid('client_name must be text.')
	const name = (rawName ?? '').trim()
	if (requireName && !name) return invalid('client_name is required.')
	if (name.length > MAX_CLIENT_NAME) {
		return invalid(`client_name must be under ${MAX_CLIENT_NAME} characters.`)
	}
	return {
		ok: true,
		client: { name: name || DEFAULT_CLIENT_NAME, redirectUris: [...new Set(redirectUris)] },
	}
}

export function isClientIdUrl(value: string): boolean {
	if (value.length > 2000 || !value.startsWith('https://')) return false
	try {
		const url = new URL(value)
		return (
			url.protocol === 'https:' &&
			url.port === '' &&
			url.pathname !== '/' &&
			!url.hash &&
			!url.username &&
			!url.password &&
			!url.pathname.split('/').some((segment) => segment === '.' || segment === '..')
		)
	} catch {
		return false
	}
}

export function parseMetadataDocument(clientId: string, body: unknown): MetadataResult {
	if (typeof body !== 'object' || body === null)
		return invalid('Metadata document is not an object.')
	const record = body as Record<string, unknown>
	if (record['client_id'] !== clientId) {
		return invalid('Metadata document client_id does not match its url.')
	}
	if ('client_secret' in record || 'client_secret_expires_at' in record) {
		return invalid('Metadata documents must not carry a client secret.')
	}
	return parseClientMetadata(body, { requireName: true, allowAppCallbacks: false })
}

const MIN_CACHE_SECONDS = 5 * 60
const MAX_CACHE_SECONDS = 24 * 60 * 60
const DEFAULT_CACHE_SECONDS = 60 * 60

export function metadataCacheSeconds(cacheControl: string | null): number {
	if (!cacheControl) return DEFAULT_CACHE_SECONDS
	if (/(^|,)\s*(no-store|no-cache)\s*(,|$)/i.test(cacheControl)) return MIN_CACHE_SECONDS
	const maxAge = /max-age=(\d+)/i.exec(cacheControl)?.[1]
	if (maxAge === undefined) return DEFAULT_CACHE_SECONDS
	return Math.min(MAX_CACHE_SECONDS, Math.max(MIN_CACHE_SECONDS, Number(maxAge)))
}
