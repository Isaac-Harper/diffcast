import { readFile } from 'node:fs/promises'
import { savedResearchNotesSchema } from './research-notes.ts'
import type { Researcher } from './research.ts'
import { checkScript } from './script-rules.ts'
import { privateProjectNames } from './work-context.ts'
import type { EpisodeWriter } from './writer.ts'

const FIXTURE_MINUTES = 3

export function createFixtureResearcher(notesPath: string): Researcher {
	return {
		async research() {
			const notes = savedResearchNotesSchema.parse(JSON.parse(await readFile(notesPath, 'utf8')))
			return {
				notes,
				record: {
					model: 'fixture',
					inputTokens: 0,
					outputTokens: 0,
					costUsd: 0,
					webSearches: 0,
					webFetches: 0,
					researchSeconds: 0,
				},
			}
		},
	}
}

export function createFixtureWriter(episodePath: string): EpisodeWriter {
	return {
		async write(listener, _notes, recordReply) {
			const reply = await readFile(episodePath, 'utf8')
			await recordReply(1, reply)
			const check = checkScript(
				JSON.parse(reply),
				FIXTURE_MINUTES,
				listener.format,
				privateProjectNames(listener.workContext)
			)
			if (!check.ok) throw new Error(`fixture episode invalid: ${check.problems.join('; ')}`)
			return {
				episode: check.episode,
				record: { model: 'fixture', inputTokens: 0, outputTokens: 0, costUsd: 0, attempts: 1 },
			}
		},
	}
}
