import { del, issueSignedToken, presignUrl } from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { MAX_AUDIO_BYTES } from '@shared/contract'
import { audioPathname } from './blob-rules'

const TOKEN_MINUTES = 15
const SIGNED_MINUTES = 10

export function blobConfigured(): boolean {
	return Boolean(process.env['BLOB_READ_WRITE_TOKEN'])
}

export async function audioUploadToken(
	listenerId: number,
	date: string
): Promise<{ pathname: string; clientToken: string }> {
	const pathname = audioPathname(listenerId, date)
	const clientToken = await generateClientTokenFromReadWriteToken({
		token: process.env['BLOB_READ_WRITE_TOKEN'],
		pathname,
		addRandomSuffix: true,
		allowedContentTypes: ['audio/mpeg'],
		maximumSizeInBytes: MAX_AUDIO_BYTES,
		validUntil: Date.now() + TOKEN_MINUTES * 60_000,
	})
	return { pathname, clientToken }
}

export async function signedAudioUrl(url: string, operation: 'get' | 'head'): Promise<string> {
	const pathname = new URL(url).pathname.slice(1)
	const validUntil = Date.now() + SIGNED_MINUTES * 60_000
	const signed = await issueSignedToken({ pathname, operations: [operation], validUntil })
	const { presignedUrl } = await presignUrl(signed, {
		operation,
		pathname,
		validUntil,
		access: 'private',
	})
	return presignedUrl
}

export async function deleteAudio(url: string): Promise<void> {
	try {
		await del(url)
	} catch (error) {
		console.error('audio delete failed', error)
	}
}
