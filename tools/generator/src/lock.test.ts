import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { acquireLock, releaseLock } from './lock.ts'
import { fileExists } from './work-directory.ts'

afterEach(() => releaseLock())

describe('acquireLock', () => {
	it('refuses while the holding pid is alive', async () => {
		const path = join(await mkdtemp(join(tmpdir(), 'diffcast-lock-')), '.lock')
		await writeFile(path, String(process.pid))
		await expect(acquireLock(path)).rejects.toThrow('another run is active')
	})

	it('replaces a stale lock and removes it on release', async () => {
		const path = join(await mkdtemp(join(tmpdir(), 'diffcast-lock-')), '.lock')
		await writeFile(path, '999999')
		await acquireLock(path)
		releaseLock()
		expect(await fileExists(path)).toBe(false)
	})
})
