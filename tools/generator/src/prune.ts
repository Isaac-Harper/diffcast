import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from './log.ts'

export const KEEP_DAYS = 14

export async function pruneWorkDirectory(workDirectory: string, now: number): Promise<void> {
	const cutoff = now - KEEP_DAYS * 86_400_000
	for (const listener of await readdir(workDirectory)) {
		if (!/^\d+$/.test(listener)) continue
		const listenerDirectory = join(workDirectory, listener)
		for (const date of await readdir(listenerDirectory)) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
			const directory = join(listenerDirectory, date)
			if ((await stat(directory)).mtimeMs > cutoff) continue
			await rm(directory, { recursive: true, force: true })
			log(`removed old work dir ${listener}/${date}`)
		}
	}
}
