import { spawnSync } from 'node:child_process'
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { Resvg } from '@resvg/resvg-js'
import {
	captionsForWindow,
	chooseWindow,
	timeTurns,
	windowForTimes,
	wrapLines,
} from './audiogram/plan.mjs'

const usage = `usage: node scripts/make-audiogram.mjs <episode work dir> [--out file.mp4] [--start s --end s] [--label text] [--min 30] [--max 45]

The work dir is a generator episode directory (<DIFFCAST_WORK_DIR>/<listener>/<date>) holding
episode.mp3, episode.json and clips/. Captions come from the script, timed by the voice clips.`

const SIZE = 1080
const MARGIN = 72
const COLORS = {
	background: '#0e1011',
	foreground: '#eceeef',
	muted: '#a0a7ac',
	line: '#272c2f',
	added: '#56c878',
	removed: '#f27f74',
}
const CAPTION = {
	top: 250,
	height: 400,
	fontSize: 64,
	lineHeight: 78,
	charactersPerLine: 28,
	maxCharacters: 52,
}
const WAVEFORM = { top: 700, height: 180 }
const SPEAKER_LABELS = { host: 'HOST', cohost: 'COHOST' }
const TAGLINE = 'What changed in your corner of tech since yesterday.'
const FONT_DIRECTORY = new URL('../node_modules/geist/dist/fonts/', import.meta.url).pathname
const FONT_FILES = [
	'geist-sans/Geist-Regular.ttf',
	'geist-sans/Geist-SemiBold.ttf',
	'geist-mono/GeistMono-Regular.ttf',
	'geist-mono/GeistMono-SemiBold.ttf',
].map((file) => join(FONT_DIRECTORY, file))

const { values: options, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: 'string' },
		start: { type: 'string' },
		end: { type: 'string' },
		label: { type: 'string' },
		min: { type: 'string', default: '30' },
		max: { type: 'string', default: '45' },
	},
})
const workDirectory = positionals[0]
if (
	!workDirectory ||
	positionals.length > 1 ||
	(options.start === undefined) !== (options.end === undefined)
) {
	console.error(usage)
	process.exit(1)
}

function run(command, args) {
	const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
	if (result.error) throw result.error
	if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr.slice(-3000)}`)
	return result.stdout
}

function durationSeconds(file) {
	const seconds = Number(
		run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
	)
	if (!(seconds > 0)) throw new Error(`could not read the duration of ${file}`)
	return seconds
}

function escapeXml(text) {
	return text.replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`)
}

function renderPng(svg, file, { height, maxContentWidth }) {
	const resvg = new Resvg(svg, {
		font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Geist' },
	})
	const bounds = resvg.getBBox()
	if (maxContentWidth && bounds && bounds.width > maxContentWidth) {
		throw new Error(
			`text is ${Math.round(bounds.width)}px wide, over ${maxContentWidth}px: ${file}`
		)
	}
	const image = resvg.render()
	if (image.height !== height)
		throw new Error(`rendered ${file} at ${image.height}px, expected ${height}`)
	writeFileSync(file, image.asPng())
}

function frameSvg(label) {
	const bar = 12
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
	<rect width="${SIZE}" height="${SIZE}" fill="${COLORS.background}"/>
	<rect x="${MARGIN}" y="${MARGIN + 8}" width="40" height="${bar}" rx="${bar / 2}" fill="${COLORS.removed}"/>
	<rect x="${MARGIN}" y="${MARGIN + 8 + bar + 10}" width="60" height="${bar}" rx="${bar / 2}" fill="${COLORS.added}"/>
	<text x="${MARGIN + 80}" y="${MARGIN + 44}" font-family="Geist Mono" font-weight="600" font-size="44" fill="${COLORS.foreground}">diffcast</text>
	<text x="${SIZE - MARGIN}" y="${MARGIN + 40}" text-anchor="end" font-family="Geist Mono" font-size="24" letter-spacing="2" fill="${COLORS.muted}">${escapeXml(label.toUpperCase())}</text>
	<line x1="${MARGIN}" y1="${WAVEFORM.top + WAVEFORM.height / 2}" x2="${SIZE - MARGIN}" y2="${WAVEFORM.top + WAVEFORM.height / 2}" stroke="${COLORS.line}" stroke-width="2"/>
	<text x="${MARGIN}" y="${SIZE - MARGIN - 44}" font-family="Geist Mono" font-weight="600" font-size="38" fill="${COLORS.foreground}">diffcast.fm</text>
	<text x="${MARGIN}" y="${SIZE - MARGIN}" font-family="Geist" font-size="26" fill="${COLORS.muted}">${escapeXml(TAGLINE)}</text>
</svg>`
}

function captionSvg(caption) {
	const lines = wrapLines(caption.text, CAPTION.charactersPerLine)
	if (lines.length > 3) throw new Error(`caption needs ${lines.length} lines: ${caption.text}`)
	const speakerColor = caption.speaker === 'host' ? COLORS.added : COLORS.removed
	const text = lines
		.map(
			(line, index) =>
				`<text x="${MARGIN}" y="${130 + index * CAPTION.lineHeight}" font-family="Geist" font-weight="600" font-size="${CAPTION.fontSize}" letter-spacing="-1.5" fill="${COLORS.foreground}">${escapeXml(line)}</text>`
		)
		.join('\n\t')
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${CAPTION.height}">
	<rect x="${MARGIN}" y="22" width="10" height="10" rx="5" fill="${speakerColor}"/>
	<text x="${MARGIN + 22}" y="36" font-family="Geist Mono" font-size="24" letter-spacing="2" fill="${COLORS.muted}">${SPEAKER_LABELS[caption.speaker]}</text>
	${text}
</svg>`
}

function seconds(value) {
	return Number(value.toFixed(3))
}

const episode = JSON.parse(readFileSync(join(workDirectory, 'episode.json'), 'utf8'))
const brief = JSON.parse(readFileSync(join(workDirectory, 'brief.json'), 'utf8'))
const audio = join(workDirectory, 'episode.mp3')
const clipFiles = readdirSync(join(workDirectory, 'clips'))
	.filter((name) => /^\d{3}-(host|cohost)-.+\.mp3$/.test(name))
	.sort()
	.map((name) => join(workDirectory, 'clips', name))
const timedTurns = timeTurns(episode.turns, clipFiles.map(durationSeconds), durationSeconds(audio))
const window =
	options.start === undefined
		? chooseWindow(timedTurns, { minSeconds: Number(options.min), maxSeconds: Number(options.max) })
		: windowForTimes(timedTurns, Number(options.start), Number(options.end))
const clipSeconds = window.end - window.start + 0.25
const captions = captionsForWindow(timedTurns, window, { maxCharacters: CAPTION.maxCharacters })
const output = resolve(options.out ?? join(workDirectory, 'audiogram.mp4'))

const scratch = mkdtempSync(join(tmpdir(), 'diffcast-audiogram-'))
try {
	const framePng = join(scratch, 'frame.png')
	renderPng(frameSvg(options.label ?? brief.date), framePng, {
		height: SIZE,
		maxContentWidth: SIZE,
	})
	const captionPngs = captions.map((caption, index) => {
		const file = join(scratch, `caption-${String(index).padStart(3, '0')}.png`)
		renderPng(captionSvg(caption), file, {
			height: CAPTION.height,
			maxContentWidth: SIZE - 2 * MARGIN,
		})
		return file
	})

	const inputs = ['-loop', '1', '-framerate', '30', '-i', framePng]
	inputs.push('-ss', String(seconds(window.start)), '-t', String(seconds(clipSeconds)), '-i', audio)
	for (const file of captionPngs) inputs.push('-i', file)
	const fadeOutAt = seconds(clipSeconds - 0.4)
	const filters = [
		`[1:a]aresample=44100,afade=t=in:d=0.15,afade=t=out:st=${fadeOutAt}:d=0.4,asplit[audio][forwave]`,
		`[forwave]showwaves=s=${SIZE - 2 * MARGIN}x${WAVEFORM.height}:mode=cline:draw=full:scale=sqrt:rate=30:colors=${COLORS.added.replace('#', '0x')}[wave]`,
		`[0:v][wave]overlay=${MARGIN}:${WAVEFORM.top}[base0]`,
	]
	captions.forEach((caption, index) => {
		filters.push(
			`[base${index}][${index + 2}:v]overlay=0:${CAPTION.top}:enable='between(t,${seconds(caption.start)},${seconds(caption.end)})'[base${index + 1}]`
		)
	})
	filters.push(`[base${captions.length}]format=yuv420p[video]`)

	mkdirSync(dirname(output), { recursive: true })
	run('ffmpeg', [
		'-v',
		'error',
		'-y',
		...inputs,
		'-filter_complex',
		filters.join(';'),
		'-map',
		'[video]',
		'-map',
		'[audio]',
		'-t',
		String(seconds(clipSeconds)),
		'-c:v',
		'libx264',
		'-preset',
		'slow',
		'-crf',
		'21',
		'-profile:v',
		'high',
		'-level',
		'4.0',
		'-r',
		'30',
		'-g',
		'60',
		'-c:a',
		'aac',
		'-b:a',
		'128k',
		'-ac',
		'2',
		'-movflags',
		'+faststart',
		output,
	])
} finally {
	rmSync(scratch, { recursive: true, force: true })
}

const megabytes = statSync(output).size / 1024 / 1024
if (megabytes >= 15)
	throw new Error(`${output} is ${megabytes.toFixed(1)} MB, over the 15 MB limit for X`)
const transcript = captions.map((caption) => caption.text).join(' ')
console.log(`wrote ${output} (${megabytes.toFixed(1)} MB)`)
console.log(
	`clip: ${seconds(window.start)}s to ${seconds(window.end)}s of the episode (${seconds(clipSeconds)}s)`
)
console.log(`captions: ${transcript}`)
