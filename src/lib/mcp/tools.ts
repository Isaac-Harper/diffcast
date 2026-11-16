import type { z } from 'zod'
import type { FeedEpisode } from '../episode-types'
import { INTEREST_FIELDS } from '../interests'
import type { InterestRow } from '../interests'
import { parseInterestsEditor } from '../interests-form'
import { formatForDate, ISO_WEEKDAYS } from '../schedule'
import { listFeedEpisodes } from '../store/episodes'
import { listInterests, saveInterests } from '../store/interests'
import { getListener, setListenerDays } from '../store/listeners'
import {
	clearWorkContext,
	countPush,
	listWorkContext,
	MAX_PUSHES_PER_DAY,
	upsertWorkContext,
} from '../store/work-context'
import { dayKeys, dayNumbers, MAX_EPISODES } from './rules'
import type {
	addInterestInput,
	clearContextInput,
	listEpisodesInput,
	pushContextInput,
	removeInterestInput,
	setDaysInput,
	setInterestsInput,
} from './rules'

export class ToolRefusal extends Error {}

export interface ToolOutput {
	summary: string
	data: Record<string, unknown>
}

function interestRows(
	interests: readonly {
		topic: string
		take?: string | null
		note?: string | null
		active?: boolean
	}[]
): InterestRow[] {
	const form = new FormData()
	form.set('interestsEditor', '1')
	for (const interest of interests) {
		form.append(INTEREST_FIELDS.topic, interest.topic)
		form.append(INTEREST_FIELDS.take, interest.take ?? '')
		form.append(INTEREST_FIELDS.note, interest.note ?? '')
		form.append(INTEREST_FIELDS.active, String(interest.active ?? true))
	}
	const parsed = parseInterestsEditor(form)
	if (!parsed.ok) throw new ToolRefusal(parsed.error)
	return parsed.input
}

function publicInterests(rows: readonly InterestRow[]) {
	return rows.map(({ topic, take, note, active }) => ({ topic, take, note, active }))
}

export async function pushContext(
	listenerId: number,
	input: z.infer<typeof pushContextInput>
): Promise<ToolOutput> {
	if ((await countPush(listenerId)) === null) {
		throw new ToolRefusal(
			`push_context is limited to ${MAX_PUSHES_PER_DAY} calls a day. Try tomorrow.`
		)
	}
	const stored = await upsertWorkContext(listenerId, {
		project: input.project,
		packages: [...new Set(input.packages ?? [])],
		topics: [...new Set(input.topics ?? [])],
		summary: input.summary ?? '',
	})
	return {
		summary: `Saved context for ${stored.project} (${stored.packages.length} packages, ${stored.topics.length} topics). It shapes the next episode and expires ${stored.expiresAt}.`,
		data: { context: stored },
	}
}

export async function listContext(listenerId: number): Promise<ToolOutput> {
	const contexts = await listWorkContext(listenerId)
	return {
		summary: contexts.length
			? `${contexts.length} project(s) in context: ${contexts.map((context) => context.project).join(', ')}.`
			: 'No work context saved.',
		data: { contexts },
	}
}

export async function clearContext(
	listenerId: number,
	input: z.infer<typeof clearContextInput>
): Promise<ToolOutput> {
	const cleared = await clearWorkContext(listenerId, input.project ?? null)
	return {
		summary: input.project
			? `Cleared ${cleared} context entry for ${input.project}.`
			: `Cleared all ${cleared} context entries.`,
		data: { cleared },
	}
}

export async function getInterests(listenerId: number): Promise<ToolOutput> {
	const interests = publicInterests(await listInterests(listenerId))
	return {
		summary: `${interests.length} interests, most important first: ${interests.map((interest) => interest.topic).join('; ')}.`,
		data: { interests },
	}
}

export async function setInterests(
	listenerId: number,
	input: z.infer<typeof setInterestsInput>
): Promise<ToolOutput> {
	const rows = interestRows(input.interests)
	await saveInterests(listenerId, rows)
	return {
		summary: `Saved ${rows.length} interests. They shape the next episode.`,
		data: { interests: publicInterests(rows) },
	}
}

export async function addInterest(
	listenerId: number,
	input: z.infer<typeof addInterestInput>
): Promise<ToolOutput> {
	const current = await listInterests(listenerId)
	if (current.some((interest) => interest.topic.toLowerCase() === input.topic.toLowerCase())) {
		throw new ToolRefusal(`${input.topic} is already an interest. Use set_interests to change it.`)
	}
	const rows = interestRows([...publicInterests(current), input])
	await saveInterests(listenerId, rows)
	return {
		summary: `Added ${input.topic}. ${rows.length} interests now.`,
		data: { interests: publicInterests(rows) },
	}
}

export async function removeInterest(
	listenerId: number,
	input: z.infer<typeof removeInterestInput>
): Promise<ToolOutput> {
	const current = publicInterests(await listInterests(listenerId))
	const kept = current.filter(
		(interest) => interest.topic.toLowerCase() !== input.topic.toLowerCase()
	)
	if (kept.length === current.length) throw new ToolRefusal(`${input.topic} is not an interest.`)
	const rows = interestRows(kept)
	await saveInterests(listenerId, rows)
	return {
		summary: `Removed ${input.topic}. ${rows.length} interests left.`,
		data: { interests: publicInterests(rows) },
	}
}

async function requireListener(listenerId: number) {
	const listener = await getListener(listenerId)
	if (!listener) throw new Error(`Listener ${listenerId} vanished during an MCP call`)
	return listener
}

function schedule(days: readonly number[], timezone: string) {
	return {
		timezone,
		days: dayKeys(days),
		formats: Object.fromEntries(
			ISO_WEEKDAYS.filter((day) => days.includes(day)).map((day) => [
				dayKeys([day])[0],
				day === 6 ? 'weekly_recap' : day === 7 ? 'week_ahead' : 'daily',
			])
		),
		arrives: 'Early morning, between 03:00 and 06:00 in the listener time zone.',
	}
}

export async function getSchedule(listenerId: number): Promise<ToolOutput> {
	const listener = await requireListener(listenerId)
	const data = schedule(listener.days, listener.timezone)
	return {
		summary: `Episodes on ${data.days.join(', ')}, early morning in ${listener.timezone}.`,
		data,
	}
}

export async function setDays(
	listenerId: number,
	input: z.infer<typeof setDaysInput>
): Promise<ToolOutput> {
	const days = dayNumbers(input.days)
	await setListenerDays(listenerId, days)
	const listener = await requireListener(listenerId)
	const data = schedule(days, listener.timezone)
	return { summary: `Episodes now arrive on ${data.days.join(', ')}.`, data }
}

const ACCOUNT_PATH = '/account'

function episodeView(episode: FeedEpisode, origin: string) {
	return {
		date: episode.published_on,
		title: episode.title,
		summary: episode.summary,
		format: formatForDate(episode.published_on),
		durationSeconds: Math.round(episode.duration_seconds),
		segments: episode.segments.map((segment) => ({
			heading: segment.heading,
			kind: segment.kind,
			topics: segment.topics ?? [],
			packages: segment.packages,
			sources: segment.sources.map((source) => ({ title: source.title, url: source.url })),
		})),
		link: `${origin}${ACCOUNT_PATH}`,
	}
}

export async function getLatestEpisode(listenerId: number, origin: string): Promise<ToolOutput> {
	const [latest] = await listFeedEpisodes(listenerId, 1)
	if (!latest) return { summary: 'No episodes yet.', data: { episode: null } }
	const episode = episodeView(latest, origin)
	return { summary: `${episode.date}: ${episode.title}. ${episode.summary}`, data: { episode } }
}

export async function listEpisodes(
	listenerId: number,
	input: z.infer<typeof listEpisodesInput>,
	origin: string
): Promise<ToolOutput> {
	const episodes = (await listFeedEpisodes(listenerId, input.limit ?? 7)).map((episode) =>
		episodeView(episode, origin)
	)
	return {
		summary: episodes.length
			? `${episodes.length} episodes, newest first: ${episodes.map((episode) => `${episode.date} ${episode.title}`).join('; ')}.`
			: 'No episodes yet.',
		data: { episodes: episodes.slice(0, MAX_EPISODES) },
	}
}
