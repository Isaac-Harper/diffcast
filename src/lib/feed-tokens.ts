import { createHash, randomBytes } from 'node:crypto'

const TOKEN = /^[0-9a-f]{64}$/
const MAX_USER_AGENT = 200

export function newFeedToken(): string {
	return randomBytes(32).toString('hex')
}

export function hashFeedToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}

export function isFeedToken(value: string): boolean {
	return TOKEN.test(value)
}

export function feedUrl(origin: string, token: string): string {
	return `${origin}/api/feed/${token}`
}

export function listenerPageUrl(origin: string, token: string): string {
	return `${origin}/l/${token}`
}

export function audioVersion(blobUrl: string): string {
	return createHash('sha256').update(blobUrl).digest('hex').slice(0, 10)
}

export function episodeAudioUrl(origin: string, token: string, episodeId: number): string {
	return `${origin}/api/audio/${token}/${episodeId}.mp3`
}

export function episodeIdFromFile(file: string): number | null {
	const match = /^(\d{1,9})\.mp3$/.exec(file)
	return match ? Number(match[1]) : null
}

export function userAgent(value: string | null): string | null {
	const trimmed = value?.trim()
	return trimmed ? trimmed.slice(0, MAX_USER_AGENT) : null
}
