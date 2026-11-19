import { join } from 'node:path'
import { parseRunOptions } from './arguments.ts'
import { workDirectoryFrom } from './config.ts'
import { concurrencyFrom, runListeners } from './due-loop.ts'
import { acquireLock, releaseLock } from './lock.ts'
import { log } from './log.ts'
import { produceEpisode } from './pipeline.ts'
import { pruneWorkDirectory } from './prune.ts'
import { createServices, selectListeners } from './services.ts'
import { ensureDirectory } from './work-directory.ts'

async function main(): Promise<void> {
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.on(signal, () => {
			log(`${signal} received`)
			releaseLock()
			process.exit(1)
		})
	}
	try {
		const options = parseRunOptions(process.argv.slice(2))
		const workDirectory = workDirectoryFrom(process.env)
		const services = await createServices(options, process.env)
		await ensureDirectory(workDirectory)
		await acquireLock(join(workDirectory, '.lock'))
		const listeners = await selectListeners(options, services.jobs, workDirectory)
		log(`${listeners.length} listener(s) to produce`)
		const result = await runListeners(
			listeners,
			(listener) =>
				produceEpisode(listener, services, {
					workDirectory,
					fromStep: options.fromStep ?? 'research',
					stopAfterMix: options.dryRun || options.noUpload || options.sample,
				}),
			services.jobs,
			concurrencyFrom(process.env)
		)
		await pruneWorkDirectory(workDirectory, Date.now()).catch((error: unknown) =>
			log(`warning: prune failed: ${error instanceof Error ? error.message : String(error)}`)
		)
		log(`done: ${result.succeeded.length} ok, ${result.failed.length} failed`)
		if (result.failed.length) process.exitCode = 1
	} catch (error) {
		log(`FAILED: ${error instanceof Error ? error.message : String(error)}`)
		process.exitCode = 1
	} finally {
		releaseLock()
	}
}

await main()
