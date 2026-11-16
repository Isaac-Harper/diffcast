'use server'

import { refresh } from 'next/cache'
import { lookupFeedToken } from '@/lib/feed-access'
import { parseFeedbackForm, parseSurveyForm, text, wholeId } from '@/lib/forms'
import { listenerOwnsEpisode } from '@/lib/store/episodes'
import { addFeedback, addSurvey } from '@/lib/store/feedback'

export type FormResult = { status: 'idle' | 'saved' | 'error'; message: string }

const UNKNOWN: FormResult = { status: 'error', message: 'This link is no longer valid.' }

export async function submitFeedback(_previous: FormResult, form: FormData): Promise<FormResult> {
	const access = await lookupFeedToken(text(form, 'token', 64))
	if (!access) return UNKNOWN
	const episodeId = wholeId(form.get('episodeId'))
	if (episodeId === null || !(await listenerOwnsEpisode(access.listenerId, episodeId))) {
		return { status: 'error', message: 'Unknown episode.' }
	}
	const parsed = parseFeedbackForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await addFeedback(episodeId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Thanks, saved.' }
}

export async function submitSurvey(_previous: FormResult, form: FormData): Promise<FormResult> {
	const access = await lookupFeedToken(text(form, 'token', 64))
	if (!access) return UNKNOWN
	const parsed = parseSurveyForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await addSurvey(access.listenerId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Thanks, saved.' }
}
