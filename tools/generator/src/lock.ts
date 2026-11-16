import { unlinkSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { log } from './log.ts'

let heldLock: string | null = null

function errorCode(error: unknown): string | undefined {
	return error instanceof Error && 'code' in error && typeof error.code === 'string'
		? error.code
		: undefined
}

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0)
		return true
	} catch (error) {
		return errorCode(error) === 'EPERM'
	}
}

export async function acquireLock(path: string): Promise<void> {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			await writeFile(path, String(process.pid), { flag: 'wx' })
			heldLock = path
			return
		} catch (error) {
			if (errorCode(error) !== 'EEXIST') throw error
		}
		const pid = Number((await readFile(path, 'utf8')).trim())
		if (Number.isInteger(pid) && pid > 0 && processAlive(pid)) {
			throw new Error(`another run is active (pid ${pid}, lock ${path})`)
		}
		log(`replacing stale lock ${path}`)
		await rm(path, { force: true })
	}
	throw new Error(`could not take the lock ${path}`)
}

export function releaseLock(): void {
	if (heldLock === null) return
	unlinkSync(heldLock)
	heldLock = null
}
