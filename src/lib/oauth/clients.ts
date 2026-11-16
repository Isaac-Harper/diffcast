import { getClient, saveMetadataClient } from '../store/oauth'
import type { OAuthClient } from './authorize-request'
import { isClientIdUrl, metadataCacheSeconds, parseMetadataDocument } from './client-metadata'
import { fetchMetadataDocument, MetadataFetchError } from './fetch-metadata-document'

const MAX_CLIENT_ID = 2000

export async function resolveClient(clientId: string | null): Promise<OAuthClient | null> {
	if (!clientId || clientId.length > MAX_CLIENT_ID) return null
	if (!isClientIdUrl(clientId)) {
		const client = await getClient(clientId)
		return client?.kind === 'registered' ? client : null
	}
	const cached = await getClient(clientId)
	if (cached?.kind === 'metadata_document' && cached.cacheUntil !== null) return cached
	let fetched
	try {
		fetched = await fetchMetadataDocument(clientId)
	} catch (error) {
		if (error instanceof MetadataFetchError) {
			console.warn(`client metadata document ${clientId}: ${error.message}`)
			return null
		}
		throw error
	}
	const parsed = parseMetadataDocument(clientId, fetched.body)
	if (!parsed.ok) {
		console.warn(`client metadata document ${clientId}: ${parsed.description}`)
		return null
	}
	await saveMetadataClient(
		clientId,
		parsed.client.name,
		parsed.client.redirectUris,
		metadataCacheSeconds(fetched.cacheControl)
	)
	return {
		id: clientId,
		kind: 'metadata_document',
		name: parsed.client.name,
		redirectUris: parsed.client.redirectUris,
	}
}
