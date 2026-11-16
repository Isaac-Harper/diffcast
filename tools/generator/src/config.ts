import { homedir } from 'node:os'

export const DEFAULT_RESEARCH_MODEL = 'google/gemini-3.8-flash'
export const DEFAULT_WRITER_MODEL = 'google/gemini-3.8-flash'
export const DEFAULT_TTS_MODEL = 'fish-audio/s2.1-pro'
export const DEFAULT_HOST_VOICE = 'e3cd384158934cc9a01029cd7d278634'
export const DEFAULT_COHOST_VOICE = '536d3a5e000945adb7038665781a4aca'

export type JobApiConfig = { jobUrl: string; jobToken: string }

export type LiveConfig = JobApiConfig & {
	gatewayApiKey: string
	researchModel: string
	writerModel: string
	ttsModel: string
	hostVoice: string
	cohostVoice: string
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
	requireEnvironment(environment, ['DIFFCAST_URL', 'DIFFCAST_JOB_TOKEN', 'AI_GATEWAY_API_KEY'])
	return {
		...loadJobApiConfig(environment),
		gatewayApiKey: requiredValue(environment, 'AI_GATEWAY_API_KEY'),
		researchModel: environment['DIFFCAST_RESEARCH_MODEL'] || DEFAULT_RESEARCH_MODEL,
		writerModel: environment['DIFFCAST_WRITER_MODEL'] || DEFAULT_WRITER_MODEL,
		ttsModel: environment['DIFFCAST_TTS_MODEL'] || DEFAULT_TTS_MODEL,
		hostVoice: environment['DIFFCAST_HOST_VOICE'] || DEFAULT_HOST_VOICE,
		cohostVoice: environment['DIFFCAST_COHOST_VOICE'] || DEFAULT_COHOST_VOICE,
	}
}
