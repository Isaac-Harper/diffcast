import { spawnSync } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { probeDurationSeconds } from './child-process.ts'
import { fileExists } from './work-directory.ts'

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

function runGenerator(workDirectory: string, args: string[]) {
	return spawnSync(
		process.execPath,
		['--experimental-strip-types', '--no-warnings', 'src/main.ts', ...args],
		{
			cwd: packageDirectory,
			env: { ...process.env, DIFFCAST_WORK_DIR: workDirectory },
			encoding: 'utf8',
		}
	)
}

describe.skipIf(!hasFfmpeg)('dry run', () => {
	it('produces an mp3 for each format in the fixture due list and resumes from mix with cached clips', async () => {
		const workDirectory = await mkdtemp(join(tmpdir(), 'diffcast-dry-'))
		const first = runGenerator(workDirectory, ['--dry-run'])
		expect(first.status, first.stdout + first.stderr).toBe(0)
		expect(first.stdout).toContain('done: 3 ok, 0 failed')
		for (const [listenerId, date] of [
			['1', '2026-11-16'],
			['2', '2026-11-21'],
			['3', '2026-11-22'],
		] as const) {
			const mp3 = join(workDirectory, listenerId, date, 'episode.mp3')
			expect(await fileExists(mp3), mp3).toBe(true)
			expect(await probeDurationSeconds(mp3)).toBeGreaterThan(60)
		}

		const resumed = runGenerator(workDirectory, [
			'--dry-run',
			'--listener',
			'1',
			'--date',
			'2026-11-16',
			'--from-step',
			'mix',
		])
		expect(resumed.status, resumed.stdout + resumed.stderr).toBe(0)
		expect(resumed.stdout).toContain('0 rendered, 8 cached')
		expect(await fileExists(join(workDirectory, '.lock'))).toBe(false)
	})
})
