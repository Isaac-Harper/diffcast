import type { DueListener } from '@shared/contract'
import { selectDue } from './due'
import { existingEpisodeKeys, recentEpisodes, recentFeedbackNotes } from './store/episodes'
import { listActiveListeners } from './store/listeners'

export const RECENT_EPISODES = 15
export const RECENT_FEEDBACK = 10

export async function dueListeners(now: Date): Promise<DueListener[]> {
	const listeners = await listActiveListeners()
	const candidates = selectDue(listeners, now, () => false)
	const existing = await existingEpisodeKeys(
		candidates.map(({ listener, date }) => ({ listenerId: listener.id, date }))
	)
	const due = candidates.filter(({ listener, date }) => !existing.has(`${listener.id}:${date}`))
	return Promise.all(
		due.map(async ({ listener, date }) => ({
			listenerId: listener.id,
			date,
			timezone: listener.timezone,
			minutes: listener.minutes,
			stack: listener.stack,
			focus: listener.focus,
			recent: await recentEpisodes(listener.id, RECENT_EPISODES),
			feedback: await recentFeedbackNotes(listener.id, RECENT_FEEDBACK),
		}))
	)
}
