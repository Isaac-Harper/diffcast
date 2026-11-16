import { homedir } from 'node:os'

export const DEFAULT_MODEL = 'claude-sonnet-5-5'
export const DEFAULT_TTS_MODEL = 'eleven_v4'

export type JobApiConfig = { jobUrl: string; jobToken: string }

export type LiveConfig = JobApiConfig & {
	anthropicApiKey: string
	model: string
	elevenLabsApiKey: string
	hostVoice: string
	cohostVoice: string
	ttsModel: string
	ttsUsdPerThousandCharacters: number
}

type Environment = Record<string, string | undefined>

function requireEnvironment(environment: Environment, names: string[]): void {
	const missing = names.filter((name) => !environment[name])
	if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`)
}

function requiredValue(environment: Environment, name: string): string {
	const found = environment[name]
	if (!found) throw new Error(`missing env: ${name}`)
	return found
}

export function workDirectoryFrom(environment: Environment): string {
	const configured = environment['DIFFCAST_WORK_DIR'] || '~/diffcast-work'
	return configured.replace(/^~(?=\/|$)/, homedir())
}

export function loadJobApiConfig(environment: Environment): JobApiConfig {
	requireEnvironment(environment, ['DIFFCAST_URL', 'DIFFCAST_JOB_TOKEN'])
	return {
		jobUrl: requiredValue(environment, 'DIFFCAST_URL').replace(/\/+$/, ''),
		jobToken: requiredValue(environment, 'DIFFCAST_JOB_TOKEN'),
	}
}

export function loadLiveConfig(environment: Environment): LiveConfig {
	requireEnvironment(environment, [
		'DIFFCAST_URL',
		'DIFFCAST_JOB_TOKEN',
		'ANTHROPIC_API_KEY',
		'ELEVENLABS_API_KEY',
		'DIFFCAST_HOST_VOICE',
		'DIFFCAST_COHOST_VOICE',
		'DIFFCAST_TTS_USD_PER_1K_CHARS',
	])
	const ttsUsdPerThousandCharacters = Number(
		requiredValue(environment, 'DIFFCAST_TTS_USD_PER_1K_CHARS')
	)
	if (!(ttsUsdPerThousandCharacters >= 0)) {
		throw new Error('DIFFCAST_TTS_USD_PER_1K_CHARS must be a non-negative number')
	}
	return {
		...loadJobApiConfig(environment),
		anthropicApiKey: requiredValue(environment, 'ANTHROPIC_API_KEY'),
		model: environment['DIFFCAST_MODEL'] || DEFAULT_MODEL,
		elevenLabsApiKey: requiredValue(environment, 'ELEVENLABS_API_KEY'),
		hostVoice: requiredValue(environment, 'DIFFCAST_HOST_VOICE'),
		cohostVoice: requiredValue(environment, 'DIFFCAST_COHOST_VOICE'),
		ttsModel: environment['DIFFCAST_TTS_MODEL'] || DEFAULT_TTS_MODEL,
		ttsUsdPerThousandCharacters,
	}
}
