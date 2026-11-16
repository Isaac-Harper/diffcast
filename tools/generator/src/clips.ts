import { createHash } from 'node:crypto'
import { readdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Turn } from '../../../shared/contract.ts'
import { ffmpeg } from './child-process.ts'
import { roundUsd } from './gateway-cost.ts'
import { log } from './log.ts'
import { wordCount } from './script-rules.ts'
import { ensureDirectory, fileExists, readJsonFile, writeJsonFile } from './work-directory.ts'

const CONCURRENT_CLIPS = 3
const COSTS_FILE = 'costs.json'

export type ClipRenderer = {
	cacheKey(speaker: Turn['speaker']): string
	render(turns: Turn[], index: number, outputPath: string): Promise<number>
}

export function clipFileName(index: number, turn: Turn, cacheKey: string): string {
	const hash = createHash('sha256').update(`${cacheKey}\n${turn.text}`).digest('hex').slice(0, 16)
	return `${String(index + 1).padStart(3, '0')}-${turn.speaker}-${hash}.mp3`
}

export type RenderedClips = { files: string[]; costUsd: number }

async function readClipCosts(path: string): Promise<Record<string, number>> {
	if (!(await fileExists(path))) return {}
	const saved = await readJsonFile(path)
	if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
		throw new Error(`${path} is malformed`)
	}
	return Object.fromEntries(
		Object.entries(saved).map(([name, cost]) => {
			if (typeof cost !== 'number') throw new Error(`${path} is malformed at ${name}`)
			return [name, cost]
		})
	)
}

export async function renderClips(
	turns: Turn[],
	directory: string,
	renderer: ClipRenderer
): Promise<RenderedClips> {
	await ensureDirectory(directory)
	const files = turns.map((turn, index) =>
		join(directory, clipFileName(index, turn, renderer.cacheKey(turn.speaker)))
	)
	const costsPath = join(directory, COSTS_FILE)
	const keep = new Set([...files, costsPath])
	for (const name of await readdir(directory)) {
		if (!keep.has(join(directory, name))) await rm(join(directory, name), { force: true })
	}
	const savedCosts = await readClipCosts(costsPath)
	const costs: Record<string, number> = {}
	for (const file of files) {
		const cost = savedCosts[basename(file)]
		if (cost !== undefined && (await fileExists(file))) costs[basename(file)] = cost
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
				costs[basename(file)] = await renderer.render(turns, index, file)
				rendered++
			} catch (error) {
				failure = error
			}
		}
	}
	await Promise.all(Array.from({ length: CONCURRENT_CLIPS }, worker))
	await writeJsonFile(costsPath, costs)
	if (failure !== null) throw failure
	log(`tts: ${files.length} clips ready (${rendered} rendered, ${files.length - rendered} cached)`)
	const costUsd = files.reduce((total, file) => {
		const cost = costs[basename(file)]
		if (cost === undefined) throw new Error(`no recorded cost for clip ${basename(file)}`)
		return total + cost
	}, 0)
	return { files, costUsd: roundUsd(costUsd) }
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
			return 0
		},
	}
}

export function ttsCharacters(turns: Turn[]): number {
	return turns.reduce((total, turn) => total + turn.text.length, 0)
}
