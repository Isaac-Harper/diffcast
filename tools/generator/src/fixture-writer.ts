import { readFile } from 'node:fs/promises'
import { checkScript } from './script-rules.ts'
import type { ScriptWriter } from './script-writer.ts'

export function createFixtureWriter(fixturePath: string): ScriptWriter {
	return {
		async write(listener, recordReply) {
			const reply = await readFile(fixturePath, 'utf8')
			await recordReply(1, reply)
			const check = checkScript(JSON.parse(reply), listener.minutes)
			if (!check.ok) throw new Error(`fixture episode invalid: ${check.problems.join('; ')}`)
			return { episode: check.episode, usages: [], researchSeconds: 0 }
		},
	}
}
