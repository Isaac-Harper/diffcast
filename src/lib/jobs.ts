import type { DueListener } from '@shared/contract'
import { selectDue } from './due'
import { activeInterests } from './store/interests'
import {
	existingEpisodeKeys,
	lastEpisodeDates,
	recentEpisodes,
	recentFeedbackNotes,
} from './store/episodes'
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
	const pairs = due.map(({ listener, date }) => ({ listenerId: listener.id, date }))
	const [interests, lastDates] = await Promise.all([
		activeInterests(due.map(({ listener }) => listener.id)),
		lastEpisodeDates(pairs),
	])
	return Promise.all(
		due.map(async ({ listener, date, format }) => {
			const listenerInterests = interests.get(listener.id)
			if (!listenerInterests) throw new Error(`No interests entry for listener ${listener.id}`)
			return {
				listenerId: listener.id,
				date,
				format,
				since: lastDates.get(listener.id) ?? null,
				timezone: listener.timezone,
				minutes: listener.minutes,
				stack: listener.stack,
				focus: listener.focus,
				interests: listenerInterests,
				recent: await recentEpisodes(listener.id, RECENT_EPISODES),
				feedback: await recentFeedbackNotes(listener.id, RECENT_FEEDBACK),
			}
		})
	)
}
