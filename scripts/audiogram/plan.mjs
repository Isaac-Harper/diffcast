const GAP_BETWEEN_SPEAKERS_SECONDS = 0.3
const GAP_SAME_SPEAKER_SECONDS = 0.15
const MAX_TIMING_DRIFT = 0.02

export function timeTurns(turns, clipDurations, mixedDurationSeconds) {
	if (turns.length !== clipDurations.length) {
		throw new Error(`${turns.length} turns but ${clipDurations.length} clips`)
	}
	const gaps = turns.map((turn, index) => {
		const following = turns[index + 1]
		if (!following) return 0
		return turn.speaker === following.speaker
			? GAP_SAME_SPEAKER_SECONDS
			: GAP_BETWEEN_SPEAKERS_SECONDS
	})
	const unscaledTotal = clipDurations.reduce(
		(sum, duration, index) => sum + duration + gaps[index],
		0
	)
	const scale = mixedDurationSeconds / unscaledTotal
	if (Math.abs(scale - 1) > MAX_TIMING_DRIFT) {
		throw new Error(
			`clips add up to ${unscaledTotal.toFixed(2)}s but the episode is ${mixedDurationSeconds.toFixed(2)}s`
		)
	}
	let cursor = 0
	return turns.map((turn, index) => {
		const start = cursor * scale
		const end = (cursor + clipDurations[index]) * scale
		cursor += clipDurations[index] + gaps[index]
		return { speaker: turn.speaker, text: turn.text, start, end }
	})
}

export function sentenceEnds(text) {
	const ends = []
	for (const match of text.matchAll(/[.?!]["')\]]*(?=\s|$)/g)) {
		ends.push(match.index + match[0].length)
	}
	if (ends.at(-1) !== text.length) ends.push(text.length)
	return ends
}

function timeAtCharacter(turn, characterIndex) {
	return turn.start + (characterIndex / turn.text.length) * (turn.end - turn.start)
}

export function chooseWindow(timedTurns, { minSeconds, maxSeconds }) {
	for (let first = 0; first < timedTurns.length; first++) {
		const start = timedTurns[first].start
		let best = null
		for (let last = first; last < timedTurns.length; last++) {
			const turn = timedTurns[last]
			if (turn.start - start > maxSeconds) break
			const speakers = new Set(timedTurns.slice(first, last + 1).map((each) => each.speaker))
			if (speakers.size < 2) continue
			for (const characterIndex of sentenceEnds(turn.text)) {
				const wholeTurn = characterIndex === turn.text.length
				const end = wholeTurn ? turn.end : timeAtCharacter(turn, characterIndex)
				const duration = end - start
				if (duration < minSeconds || duration > maxSeconds) continue
				const candidate = { first, last, cutAt: characterIndex, start, end, wholeTurn }
				if (
					!best ||
					(wholeTurn && !best.wholeTurn) ||
					(wholeTurn === best.wholeTurn && end > best.end)
				) {
					best = candidate
				}
			}
		}
		if (best) return best
	}
	throw new Error(`no stretch of ${minSeconds} to ${maxSeconds}s with both hosts found`)
}

export function windowForTimes(timedTurns, startSeconds, endSeconds) {
	const first = timedTurns.findIndex((turn) => turn.end > startSeconds)
	const last = timedTurns.findLastIndex((turn) => turn.start < endSeconds)
	if (first === -1 || last < first) throw new Error('the requested times cover no turn')
	const lastTurn = timedTurns[last]
	const wholeTurn = endSeconds >= lastTurn.end
	const fraction = wholeTurn ? 1 : (endSeconds - lastTurn.start) / (lastTurn.end - lastTurn.start)
	return {
		first,
		last,
		cutAt: Math.round(fraction * lastTurn.text.length),
		start: startSeconds,
		end: endSeconds,
		wholeTurn,
	}
}

export function chunkWords(text, maxCharacters) {
	const chunks = []
	let current = ''
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const joined = current ? `${current} ${word}` : word
		if (current && joined.length > maxCharacters) {
			chunks.push(current)
			current = word
		} else {
			current = joined
		}
		const breaksSentence = /[.?!]["')\]]*$/.test(word) && current.length >= 12
		const breaksClause = /[,;:]$/.test(word) && current.length >= maxCharacters * 0.55
		if (breaksSentence || breaksClause) {
			chunks.push(current)
			current = ''
		}
	}
	if (current) chunks.push(current)
	return chunks
}

export function wrapLines(text, maxCharactersPerLine) {
	const lines = []
	let current = ''
	for (const word of text.split(' ')) {
		const joined = current ? `${current} ${word}` : word
		if (current && joined.length > maxCharactersPerLine) {
			lines.push(current)
			current = word
		} else {
			current = joined
		}
	}
	if (current) lines.push(current)
	return lines
}

export function captionsForWindow(timedTurns, window, { maxCharacters, holdGapSeconds = 0.6 }) {
	const captions = []
	for (let index = window.first; index <= window.last; index++) {
		const turn = timedTurns[index]
		const text = index === window.last ? turn.text.slice(0, window.cutAt).trim() : turn.text
		let characterCursor = 0
		for (const chunk of chunkWords(text, maxCharacters)) {
			const chunkStart = turn.text.indexOf(chunk.split(' ')[0], characterCursor)
			characterCursor = chunkStart + chunk.length
			captions.push({
				speaker: turn.speaker,
				text: chunk,
				start: Math.max(timeAtCharacter(turn, chunkStart), window.start) - window.start,
				end: Math.min(timeAtCharacter(turn, characterCursor), window.end) - window.start,
			})
		}
	}
	return captions.map((caption, index) => {
		const following = captions[index + 1]
		const end =
			following && following.start - caption.end < holdGapSeconds ? following.start : caption.end
		return { ...caption, end }
	})
}
