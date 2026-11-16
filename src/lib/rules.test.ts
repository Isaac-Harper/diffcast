import { describe, expect, it } from 'vitest'
import { blobStoreId, isBlobUrl } from './blob-rules'
import { dueDay, selectDue } from './due'
import { buildFeed, durationTag, pubDate, xmlEscape } from './feed'
import type { FeedEpisode } from './episode-types'
import {
	audioVersion,
	episodeIdFromFile,
	feedUrl,
	hashFeedToken,
	isFeedToken,
	listenerPageUrl,
	newFeedToken,
	userAgent,
} from './feed-tokens'
import { parseFeedbackForm, parseListenerForm } from './forms'
import { formatForDate, normalizeDays, scheduleLabel } from './schedule'
import { signSession, signingKey, verifySession } from './session'
import { calendarDaysFrom, isTimeZone, zonedInstant } from './time'

const TOKEN = 'a'.repeat(64)
const AUDIO = 'https://abc123.private.blob.vercel-storage.com/episodes/4/2026-11-16-x1y2.mp3'

function episode(overrides: Partial<FeedEpisode> = {}): FeedEpisode {
	return {
		id: 7,
		published_on: '2026-11-16',
		title: 'Next 16.5 ships',
		summary: 'A release.',
		segments: [
			{
				heading: 'Next.js 16.5',
				kind: 'news',
				challenges: null,
				topics: ['Developer tools and web development'],
				packages: ['next'],
				sources: [{ title: 'Release notes', url: 'https://github.com/vercel/next.js?a=1&b=2' }],
			},
		],
		audio_url: AUDIO,
		audio_bytes: 9_000_000,
		duration_seconds: 605.4,
		...overrides,
	}
}

function form(values: Record<string, string>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) data.set(key, value)
	return data
}

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]
const WEEKDAYS = [1, 2, 3, 4, 5]

describe('due rule', () => {
	it('is due from 03:00 to 05:59 local on a scheduled day', () => {
		const zone = 'America/Los_Angeles'
		expect(dueDay(new Date('2026-11-16T10:59:00Z'), zone, EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-11-16T11:00:00Z'), zone, EVERY_DAY)).toEqual({
			date: '2026-11-16',
			format: 'daily',
		})
		expect(dueDay(new Date('2026-11-16T13:59:00Z'), zone, EVERY_DAY)?.date).toBe('2026-11-16')
		expect(dueDay(new Date('2026-11-16T14:00:00Z'), zone, EVERY_DAY)).toBeNull()
	})

	it('runs on weekends with the recap on Saturday and the look ahead on Sunday', () => {
		const zone = 'America/Los_Angeles'
		expect(dueDay(new Date('2026-11-21T12:00:00Z'), zone, EVERY_DAY)).toEqual({
			date: '2026-11-21',
			format: 'weekly_recap',
		})
		expect(dueDay(new Date('2026-11-22T12:00:00Z'), zone, EVERY_DAY)).toEqual({
			date: '2026-11-22',
			format: 'week_ahead',
		})
		expect(dueDay(new Date('2026-11-20T12:00:00Z'), zone, EVERY_DAY)?.format).toBe('daily')
	})

	it('skips the days a listener turned off, by the local weekday', () => {
		expect(dueDay(new Date('2026-11-21T12:00:00Z'), 'America/Los_Angeles', WEEKDAYS)).toBeNull()
		expect(dueDay(new Date('2026-11-22T12:00:00Z'), 'America/Los_Angeles', WEEKDAYS)).toBeNull()
		expect(dueDay(new Date('2026-11-15T18:30:00Z'), 'Asia/Tokyo', WEEKDAYS)?.date).toBe(
			'2026-11-16'
		)
		expect(dueDay(new Date('2026-11-14T18:30:00Z'), 'Asia/Tokyo', WEEKDAYS)).toBeNull()
		expect(dueDay(new Date('2026-11-14T18:30:00Z'), 'Asia/Tokyo', [7])).toEqual({
			date: '2026-11-15',
			format: 'week_ahead',
		})
		const mondayWednesday = [1, 3]
		expect(dueDay(new Date('2026-11-17T12:00:00Z'), 'UTC', mondayWednesday)).toBeNull()
		expect(dueDay(new Date('2026-11-18T04:00:00Z'), 'UTC', mondayWednesday)?.date).toBe(
			'2026-11-18'
		)
	})

	it('uses the local date, not the UTC one', () => {
		expect(dueDay(new Date('2026-11-16T18:30:00Z'), 'Asia/Tokyo', EVERY_DAY)?.date).toBe(
			'2026-11-17'
		)
		expect(dueDay(new Date('2026-11-16T15:00:00Z'), 'Pacific/Auckland', EVERY_DAY)?.date).toBe(
			'2026-11-17'
		)
		expect(dueDay(new Date('2026-11-20T15:00:00Z'), 'Pacific/Auckland', EVERY_DAY)).toEqual({
			date: '2026-11-21',
			format: 'weekly_recap',
		})
	})

	it('follows daylight saving time, weekends included', () => {
		const zone = 'America/New_York'
		expect(dueDay(new Date('2026-03-06T07:00:00Z'), zone, EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-03-06T08:00:00Z'), zone, EVERY_DAY)?.date).toBe('2026-03-06')
		expect(dueDay(new Date('2026-03-08T06:30:00Z'), zone, EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-03-08T07:00:00Z'), zone, EVERY_DAY)).toEqual({
			date: '2026-03-08',
			format: 'week_ahead',
		})
		expect(dueDay(new Date('2026-03-09T07:00:00Z'), zone, EVERY_DAY)?.date).toBe('2026-03-09')
		expect(dueDay(new Date('2026-03-09T10:00:00Z'), zone, EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-11-01T07:00:00Z'), zone, EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-11-01T08:00:00Z'), zone, EVERY_DAY)?.format).toBe('week_ahead')
		expect(dueDay(new Date('2026-10-25T02:30:00Z'), 'Europe/London', EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-10-25T03:00:00Z'), 'Europe/London', EVERY_DAY)?.date).toBe(
			'2026-10-25'
		)
		expect(dueDay(new Date('2026-10-26T02:30:00Z'), 'Europe/London', EVERY_DAY)).toBeNull()
		expect(dueDay(new Date('2026-10-26T03:30:00Z'), 'Europe/London', EVERY_DAY)?.date).toBe(
			'2026-10-26'
		)
	})

	it('drops listeners who already have that day or have it turned off', () => {
		const listeners = [
			{ id: 1, timezone: 'America/Los_Angeles', days: EVERY_DAY },
			{ id: 2, timezone: 'America/Los_Angeles', days: EVERY_DAY },
			{ id: 3, timezone: 'Europe/Berlin', days: EVERY_DAY },
			{ id: 4, timezone: 'America/Los_Angeles', days: [2, 3, 4, 5, 6] },
		]
		const due = selectDue(listeners, new Date('2026-11-16T12:00:00Z'), (id) => id === 2)
		expect(due).toEqual([{ listener: listeners[0], date: '2026-11-16', format: 'daily' }])
	})
})

describe('schedule', () => {
	it('normalizes day sets and names them', () => {
		expect(normalizeDays(['7', '1', '1', '3'])).toEqual([1, 3, 7])
		expect(normalizeDays([])).toBeNull()
		expect(normalizeDays(['0'])).toBeNull()
		expect(normalizeDays(['8'])).toBeNull()
		expect(normalizeDays(['mon'])).toBeNull()
		expect(scheduleLabel(EVERY_DAY)).toBe('Every day')
		expect(scheduleLabel(WEEKDAYS)).toBe('Weekdays')
		expect(scheduleLabel([6, 7])).toBe('Weekends')
		expect(scheduleLabel([1, 3, 5])).toBe('Mon, Wed, Fri')
	})

	it('maps dates to formats', () => {
		expect(formatForDate('2026-11-20')).toBe('daily')
		expect(formatForDate('2026-11-21')).toBe('weekly_recap')
		expect(formatForDate('2026-11-22')).toBe('week_ahead')
	})
})

describe('time', () => {
	it('finds a local wall time across DST', () => {
		expect(zonedInstant('2026-07-06', 6, 'America/Los_Angeles').toISOString()).toBe(
			'2026-07-06T13:00:00.000Z'
		)
		expect(zonedInstant('2026-12-07', 6, 'America/Los_Angeles').toISOString()).toBe(
			'2026-12-07T14:00:00.000Z'
		)
		expect(zonedInstant('2026-03-08', 6, 'America/New_York').toISOString()).toBe(
			'2026-03-08T10:00:00.000Z'
		)
		expect(zonedInstant('2026-11-17', 6, 'Asia/Kolkata').toISOString()).toBe(
			'2026-11-17T00:30:00.000Z'
		)
	})

	it('validates time zones and lists calendar days', () => {
		expect(isTimeZone('Europe/Berlin')).toBe(true)
		expect(isTimeZone('Mars/Olympus')).toBe(false)
		expect(isTimeZone('')).toBe(false)
		expect(calendarDaysFrom('2026-11-20', 3)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22'])
	})
})

describe('blob url check', () => {
	it('reads the store id from the read-write token', () => {
		expect(blobStoreId('vercel_blob_rw_Abc123_secret')).toBe('abc123')
		expect(blobStoreId('vercel_blob_rw_')).toBeNull()
		expect(blobStoreId(undefined)).toBeNull()
	})

	it('accepts only the store, the listener folder and no escapes', () => {
		expect(isBlobUrl(AUDIO, 'abc123', 4)).toBe(true)
		expect(isBlobUrl(AUDIO, null, 4)).toBe(false)
		expect(isBlobUrl(AUDIO, 'abc123', 5)).toBe(false)
		for (const url of [
			'http://abc123.private.blob.vercel-storage.com/episodes/4/a.mp3',
			'https://abc123.public.blob.vercel-storage.com/episodes/4/a.mp3',
			'https://other.private.blob.vercel-storage.com/episodes/4/a.mp3',
			'https://x.abc123.private.blob.vercel-storage.com/episodes/4/a.mp3',
			'https://abc123.private.blob.vercel-storage.com.evil.com/episodes/4/a.mp3',
			'https://abc123.private.blob.vercel-storage.com:8443/episodes/4/a.mp3',
			'https://u:p@abc123.private.blob.vercel-storage.com/episodes/4/a.mp3',
			'https://abc123.private.blob.vercel-storage.com/episodes/4/a.mp3?x=1',
			'https://abc123.private.blob.vercel-storage.com/episodes/4/%2e%2e/a.mp3',
			'https://abc123.private.blob.vercel-storage.com/episodes/4/../5/a.mp3',
			'https://abc123.private.blob.vercel-storage.com/episodes/44/a.mp3',
			'https://abc123.private.blob.vercel-storage.com/episodes/4/a.wav',
			'not a url',
		]) {
			expect(isBlobUrl(url, 'abc123', 4), url).toBe(false)
		}
	})
})

describe('feed tokens', () => {
	it('makes random 64 hex tokens and hashes them with SHA-256', () => {
		const one = newFeedToken()
		expect(one).toMatch(/^[0-9a-f]{64}$/)
		expect(one).not.toBe(newFeedToken())
		expect(hashFeedToken('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		)
		for (const bad of ['', 'A'.repeat(64), 'a'.repeat(63), `${'a'.repeat(64)}/x`, '../feed']) {
			expect(isFeedToken(bad), bad).toBe(false)
		}
	})

	it('builds urls and parses episode files', () => {
		expect(feedUrl('https://d.fm', TOKEN)).toBe(`https://d.fm/api/feed/${TOKEN}`)
		expect(listenerPageUrl('https://d.fm', TOKEN)).toBe(`https://d.fm/l/${TOKEN}`)
		expect(episodeIdFromFile('12.mp3')).toBe(12)
		for (const bad of ['12', '12.mp4', 'x.mp3', '1234567890.mp3', '-1.mp3']) {
			expect(episodeIdFromFile(bad), bad).toBeNull()
		}
		expect(userAgent('x'.repeat(300))).toHaveLength(200)
		expect(userAgent('  ')).toBeNull()
	})
})

describe('feed xml', () => {
	it('escapes every special character', () => {
		expect(xmlEscape(`<a href="x">&'</a>\u0001`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;'
		)
	})

	it('dates an episode at 06:00 in the listener zone', () => {
		expect(pubDate('2026-07-06', 'America/Los_Angeles')).toBe('Mon, 06 Jul 2026 13:00:00 GMT')
		expect(pubDate('2026-12-07', 'Europe/Berlin')).toBe('Mon, 07 Dec 2026 05:00:00 GMT')
		expect(durationTag(605.4)).toBe('0:10:05')
		expect(durationTag(3725)).toBe('1:02:05')
	})

	it('builds a private, escaped feed without the Blob url', () => {
		const xml = buildFeed('https://d.fm', TOKEN, { name: 'Ana & Co', timezone: 'UTC' }, [
			episode({ title: 'Tom & Jerry <live>' }),
		])
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
		expect(xml).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"')
		expect(xml).toContain('xmlns:podcast="https://podcastindex.org/namespace/1.0"')
		expect(xml).toContain('<title>Diffcast for Ana &amp; Co</title>')
		expect(xml).toContain('<itunes:block>Yes</itunes:block>')
		expect(xml).toContain('<podcast:locked>yes</podcast:locked>')
		expect(xml).toContain('<itunes:image href="https://d.fm/cover.png"/>')
		expect(xml).toContain('<title>Tom &amp; Jerry &lt;live&gt;</title>')
		expect(xml).toContain(`<guid isPermaLink="false">diffcast-7-${audioVersion(AUDIO)}</guid>`)
		expect(xml).toContain(
			`<enclosure url="https://d.fm/api/audio/${TOKEN}/7.mp3?v=${audioVersion(AUDIO)}" length="9000000" type="audio/mpeg"/>`
		)
		expect(xml).toContain('<itunes:duration>0:10:05</itunes:duration>')
		expect(xml).toContain(
			'Next.js 16.5\nRelease notes: https://github.com/vercel/next.js?a=1&amp;b=2'
		)
		expect(xml).toContain('<pubDate>Mon, 16 Nov 2026 06:00:00 GMT</pubDate>')
		expect(xml).not.toContain('blob.vercel-storage.com')
		expect(xml).not.toContain('<live>')
	})

	it('gives new audio a new guid and keeps 30 items', () => {
		const guid = (xml: string) => /<guid[^>]*>([^<]+)</.exec(xml)?.[1]
		const listener = { name: 'A', timezone: 'UTC' }
		const first = buildFeed('https://d.fm', TOKEN, listener, [episode()])
		const rerun = buildFeed('https://d.fm', TOKEN, listener, [
			episode({ audio_url: AUDIO.replace('x1y2', 'z9z9') }),
		])
		expect(guid(first)).not.toBe(guid(rerun))
		const many = Array.from({ length: 40 }, (_, index) => episode({ id: index + 1 }))
		expect(buildFeed('https://d.fm', TOKEN, listener, many).match(/<item>/g)).toHaveLength(30)
	})
})

describe('session', () => {
	it('signs and verifies, and rejects tampering or expiry', () => {
		const key = signingKey('s'.repeat(32), 'password')
		const token = signSession(key, 1_000)
		expect(verifySession(token, key, 2_000)).toBe(true)
		expect(verifySession(token, signingKey('s'.repeat(32), 'other'), 2_000)).toBe(false)
		expect(verifySession(`${token}x`, key, 2_000)).toBe(false)
		expect(verifySession(token, key, 1_000 + 31 * 24 * 3600 * 1000)).toBe(false)
		expect(verifySession(undefined, key)).toBe(false)
	})
})

describe('forms', () => {
	it('parses a listener with a pasted stack and their days', () => {
		const values = form({
			name: ' Ana ',
			email: '',
			timezone: 'Europe/Berlin',
			minutes: '8',
			focus: 'Payments API',
			stack: '{"dependencies":{"next":"16"},"devDependencies":{"vitest":"5"}}',
		})
		for (const day of ['5', '1', '6']) values.append('days', day)
		const parsed = parseListenerForm(values)
		expect(parsed).toEqual({
			ok: true,
			input: {
				name: 'Ana',
				email: null,
				timezone: 'Europe/Berlin',
				minutes: 8,
				days: [1, 5, 6],
				focus: 'Payments API',
				stack: [
					{ name: 'next', ecosystem: 'npm' },
					{ name: 'vitest', ecosystem: 'npm' },
				],
			},
		})
	})

	it('rejects a bad zone, minutes, email or no days', () => {
		const base = { name: 'Ana', timezone: 'UTC', minutes: '10', days: '3' }
		expect(parseListenerForm(form(base)).ok).toBe(true)
		expect(parseListenerForm(form({ ...base, days: '' }))).toEqual({
			ok: false,
			error: 'Pick at least one day.',
		})
		expect(parseListenerForm(form({ ...base, days: '9' })).ok).toBe(false)
		expect(parseListenerForm(form({ ...base, timezone: 'Nowhere/Here' })).ok).toBe(false)
		expect(parseListenerForm(form({ ...base, minutes: '30' })).ok).toBe(false)
		expect(parseListenerForm(form({ ...base, email: 'nope' })).ok).toBe(false)
		expect(parseListenerForm(form({ ...base, name: ' ' })).ok).toBe(false)
	})

	it('parses feedback', () => {
		expect(parseFeedbackForm(form({ listened: 'partly', useful: 'up', note: ' ok ' }))).toEqual({
			ok: true,
			input: { listened: 'partly', useful: 'up', note: 'ok' },
		})
		expect(parseFeedbackForm(form({ listened: 'yes' }))).toEqual({
			ok: true,
			input: { listened: 'yes', useful: null, note: '' },
		})
		expect(parseFeedbackForm(form({ listened: 'maybe' })).ok).toBe(false)
		expect(parseFeedbackForm(form({ listened: 'yes', useful: 'sideways' })).ok).toBe(false)
	})
})
