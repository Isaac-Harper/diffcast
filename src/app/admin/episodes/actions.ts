'use server'

import { refresh } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { parseSegmentCheckForm } from '@/lib/forms'
import { getEpisode } from '@/lib/store/episodes'
import { saveSegmentCheck } from '@/lib/store/feedback'

export type CheckResult = { status: 'idle' | 'saved' | 'error'; message: string }

export async function saveCheck(_previous: CheckResult, form: FormData): Promise<CheckResult> {
	await requireSession()
	const parsed = parseSegmentCheckForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	const { episodeId, segmentIndex, verdict, note } = parsed.input
	const episode = await getEpisode(episodeId)
	if (!episode || segmentIndex >= episode.segments.length) {
		return { status: 'error', message: 'Unknown segment.' }
	}
	await saveSegmentCheck(episodeId, segmentIndex, { verdict, note })
	refresh()
	return { status: 'saved', message: 'Saved.' }
}
