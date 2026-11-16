import { homedir } from 'node:os'

export const DEFAULT_MODEL = 'claude-sonnet-5-5'
export const DEFAULT_TTS_MODEL = 'eleven_v4'

export type LiveConfig = {
	jobUrl: string
	jobToken: string
	anthropicApiKey: string
	model: string
	elevenLabsApiKey: string
	hostVoice: string
	cohostVoice: string
	ttsModel: string
	ttsUsdPerThousandCharacters: number
}

type Environment = Record<string, string | undefined>

export function workDirectoryFrom(environment: Environment): string {
	const configured = environment['DIFFCAST_WORK_DIR'] || '~/diffcast-work'
	return configured.replace(/^~(?=\/|$)/, homedir())
}

export function loadLiveConfig(environment: Environment): LiveConfig {
	const required = [
		'DIFFCAST_URL',
		'DIFFCAST_JOB_TOKEN',
		'ANTHROPIC_API_KEY',
		'ELEVENLABS_API_KEY',
		'DIFFCAST_HOST_VOICE',
		'DIFFCAST_COHOST_VOICE',
		'DIFFCAST_TTS_USD_PER_1K_CHARS',
	]
	const missing = required.filter((name) => !environment[name])
	if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`)
	const value = (name: string): string => {
		const found = environment[name]
		if (!found) throw new Error(`missing env: ${name}`)
		return found
	}
	const ttsUsdPerThousandCharacters = Number(value('DIFFCAST_TTS_USD_PER_1K_CHARS'))
	if (!(ttsUsdPerThousandCharacters >= 0)) {
		throw new Error('DIFFCAST_TTS_USD_PER_1K_CHARS must be a non-negative number')
	}
	return {
		jobUrl: value('DIFFCAST_URL').replace(/\/+$/, ''),
		jobToken: value('DIFFCAST_JOB_TOKEN'),
		anthropicApiKey: value('ANTHROPIC_API_KEY'),
		model: environment['DIFFCAST_MODEL'] || DEFAULT_MODEL,
		elevenLabsApiKey: value('ELEVENLABS_API_KEY'),
		hostVoice: value('DIFFCAST_HOST_VOICE'),
		cohostVoice: value('DIFFCAST_COHOST_VOICE'),
		ttsModel: environment['DIFFCAST_TTS_MODEL'] || DEFAULT_TTS_MODEL,
		ttsUsdPerThousandCharacters,
	}
}
