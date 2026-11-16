'use server'

import { refresh } from 'next/cache'
import { feedAccess } from '@/lib/feed-access'
import type { MissStatus } from '@/lib/feed-access'
import { parseInterestsEditor } from '@/lib/interests-form'
import { parseDaysForm, parseFeedbackForm, text, wholeId } from '@/lib/forms'
import type { FormResult } from '@/lib/form-result'
import { clientIp } from '@/lib/login-throttle'
import { listenerOwnsEpisode } from '@/lib/store/episodes'
import { addFeedback } from '@/lib/store/feedback'
import { saveInterests } from '@/lib/store/interests'
import { setListenerDays } from '@/lib/store/listeners'

function denied(status: MissStatus): FormResult {
	return {
		status: 'error',
		message:
			status === 429 ? 'Too many attempts. Try again later.' : 'This link is no longer valid.',
	}
}

export async function submitFeedback(_previous: FormResult, form: FormData): Promise<FormResult> {
	const access = await feedAccess(await clientIp(), text(form, 'token', 64))
	if (typeof access === 'number') return denied(access)
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

export async function saveMyInterests(_previous: FormResult, form: FormData): Promise<FormResult> {
	const access = await feedAccess(await clientIp(), text(form, 'token', 64))
	if (typeof access === 'number') return denied(access)
	const parsed = parseInterestsEditor(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await saveInterests(access.listenerId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Interests saved. They shape your next episode.' }
}

export async function saveMyDays(_previous: FormResult, form: FormData): Promise<FormResult> {
	const access = await feedAccess(await clientIp(), text(form, 'token', 64))
	if (typeof access === 'number') return denied(access)
	const parsed = parseDaysForm(form)
	if (!parsed.ok) return { status: 'error', message: parsed.error }
	await setListenerDays(access.listenerId, parsed.input)
	refresh()
	return { status: 'saved', message: 'Days saved.' }
}
