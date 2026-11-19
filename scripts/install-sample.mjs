import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const directory = process.argv[2]
if (!directory) {
	console.error('usage: node scripts/install-sample.mjs <work dir of a --sample run>')
	process.exit(1)
}

const episode = JSON.parse(readFileSync(join(directory, 'episode.json'), 'utf8'))
const brief = JSON.parse(readFileSync(join(directory, 'brief.json'), 'utf8'))
const audio = join(directory, 'episode.mp3')
if (brief.listenerId !== 999999) {
	console.error('refusing: this work dir is not from a --sample run (listener 999999)')
	process.exit(1)
}

const probe = spawnSync(
	'ffprobe',
	['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio],
	{ encoding: 'utf8' }
)
const durationSeconds = Math.round(Number(probe.stdout))
if (!(durationSeconds > 0)) throw new Error('could not read the mp3 duration with ffprobe')

const target = new URL('../public/sample/', import.meta.url).pathname
mkdirSync(target, { recursive: true })
copyFileSync(audio, join(target, 'diffcast-sample.mp3'))
const details = {
	title: episode.title,
	summary: episode.summary,
	publishedOn: brief.date,
	durationSeconds,
	audioBytes: statSync(audio).size,
	segments: episode.segments.map((segment) => ({
		kind: segment.kind,
		heading: segment.heading,
		sources: segment.sources,
	})),
}
writeFileSync(join(target, 'sample.json'), `${JSON.stringify(details, null, '\t')}\n`)
console.log(`installed ${details.title} (${durationSeconds}s) into public/sample/`)
