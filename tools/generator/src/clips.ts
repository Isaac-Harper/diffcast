import { createHash } from 'node:crypto'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Turn } from '../../../shared/contract.ts'
import { ffmpeg } from './child-process.ts'
import { log } from './log.ts'
import { wordCount } from './script-rules.ts'
import { ensureDirectory, fileExists } from './work-directory.ts'

const CONCURRENT_CLIPS = 3

export type ClipRenderer = {
	cacheKey(speaker: Turn['speaker']): string
	render(turns: Turn[], index: number, outputPath: string): Promise<void>
}

export function clipFileName(index: number, turn: Turn, cacheKey: string): string {
	const hash = createHash('sha256').update(`${cacheKey}\n${turn.text}`).digest('hex').slice(0, 16)
	return `${String(index + 1).padStart(3, '0')}-${turn.speaker}-${hash}.mp3`
}

export async function renderClips(
	turns: Turn[],
	directory: string,
	renderer: ClipRenderer
): Promise<string[]> {
	await ensureDirectory(directory)
	const files = turns.map((turn, index) =>
		join(directory, clipFileName(index, turn, renderer.cacheKey(turn.speaker)))
	)
	const keep = new Set(files)
	for (const name of await readdir(directory)) {
		if (!keep.has(join(directory, name))) await rm(join(directory, name), { force: true })
	}

	let next = 0
	let rendered = 0
	let failure: unknown = null
	const worker = async (): Promise<void> => {
		while (failure === null) {
			const index = next++
			const file = files[index]
			if (file === undefined) return
			if (await fileExists(file)) continue
			try {
				await renderer.render(turns, index, file)
				rendered++
			} catch (error) {
				failure = error
			}
		}
	}
	await Promise.all(Array.from({ length: CONCURRENT_CLIPS }, worker))
	if (failure !== null) throw failure
	log(`tts: ${files.length} clips ready (${rendered} rendered, ${files.length - rendered} cached)`)
	return files
}

export function createSilentRenderer(): ClipRenderer {
	return {
		cacheKey: (speaker) => `silent-${speaker}`,
		async render(turns, index, outputPath) {
			const turn = turns[index]
			if (!turn) throw new Error(`no turn ${index}`)
			const seconds = Math.max(0.5, wordCount(turn.text) / 2.5)
			await ffmpeg([
				'-f',
				'lavfi',
				'-i',
				'anullsrc=r=44100:cl=mono',
				'-t',
				String(seconds),
				'-q:a',
				'9',
				outputPath,
			])
		},
	}
}

export function ttsCharacters(turns: Turn[]): number {
	return turns.reduce((total, turn) => total + turn.text.length, 0)
}
