import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Turn } from '../../../shared/contract.ts'
import { ffmpeg, probeDurationSeconds } from './child-process.ts'
import { log } from './log.ts'

const GAP_BETWEEN_SPEAKERS_SECONDS = 0.3
const GAP_SAME_SPEAKER_SECONDS = 0.15

export type MixedEpisode = { file: string; durationSeconds: number; bytes: number }

export function gapAfter(turns: Turn[], index: number): number {
	const current = turns[index]
	const following = turns[index + 1]
	if (!current || !following) return 0
	return current.speaker === following.speaker
		? GAP_SAME_SPEAKER_SECONDS
		: GAP_BETWEEN_SPEAKERS_SECONDS
}

export async function mixEpisode(
	directory: string,
	turns: Turn[],
	clips: string[],
	date: string
): Promise<MixedEpisode> {
	if (clips.length !== turns.length) throw new Error('clip count does not match turn count')
	const inputs: string[] = []
	const filters: string[] = []
	const labels: string[] = []
	clips.forEach((clip, index) => {
		inputs.push('-i', clip)
		const pad = gapAfter(turns, index)
		filters.push(
			`[${index}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono${pad ? `,apad=pad_dur=${pad}` : ''}[a${index}]`
		)
		labels.push(`[a${index}]`)
	})
	filters.push(
		`${labels.join('')}concat=n=${clips.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`
	)
	const file = join(directory, 'episode.mp3')
	await ffmpeg([
		...inputs,
		'-filter_complex',
		filters.join(';'),
		'-map',
		'[out]',
		'-ar',
		'44100',
		'-ac',
		'1',
		'-c:a',
		'libmp3lame',
		'-b:a',
		'96k',
		'-metadata',
		`title=Diffcast ${date}`,
		'-metadata',
		'artist=Diffcast',
		'-metadata',
		`date=${date}`,
		file,
	])
	const mixed = await probeMix(file)
	log(`mix: ${mixed.durationSeconds}s, ${mixed.bytes} bytes`)
	return mixed
}

export async function probeMix(file: string): Promise<MixedEpisode> {
	const durationSeconds = await probeDurationSeconds(file)
	const { size } = await stat(file)
	return { file, durationSeconds, bytes: size }
}
