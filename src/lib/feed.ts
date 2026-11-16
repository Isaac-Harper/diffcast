import { audioVersion, episodeAudioUrl } from './feed-tokens'
import type { FeedEpisode } from './episode-types'
import { zonedInstant } from './time'

export const FEED_EPISODES = 30
export const PUBLISH_HOUR = 6

export function xmlEscape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
}

export function pubDate(date: string, timeZone: string): string {
	return zonedInstant(date, PUBLISH_HOUR, timeZone).toUTCString()
}

export function episodeDescription(episode: FeedEpisode): string {
	const parts = [episode.summary]
	for (const segment of episode.segments) {
		parts.push(
			[segment.heading, ...segment.sources.map((source) => `${source.title}: ${source.url}`)].join(
				'\n'
			)
		)
	}
	return parts.join('\n\n')
}

export function durationTag(seconds: number): string {
	const whole = Math.round(seconds)
	const hours = Math.floor(whole / 3600)
	const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, '0')
	const rest = String(whole % 60).padStart(2, '0')
	return `${hours}:${minutes}:${rest}`
}

function feedItem(origin: string, token: string, timeZone: string, episode: FeedEpisode): string {
	const version = audioVersion(episode.audio_url)
	const enclosure = `${episodeAudioUrl(origin, token, episode.id)}?v=${version}`
	return `
		<item>
			<title>${xmlEscape(episode.title)}</title>
			<guid isPermaLink="false">diffcast-${episode.id}-${version}</guid>
			<pubDate>${pubDate(episode.published_on, timeZone)}</pubDate>
			<description>${xmlEscape(episodeDescription(episode))}</description>
			<enclosure url="${xmlEscape(enclosure)}" length="${episode.audio_bytes}" type="audio/mpeg"/>
			<itunes:duration>${durationTag(episode.duration_seconds)}</itunes:duration>
			<itunes:explicit>false</itunes:explicit>
		</item>`
}

export function buildFeed(
	origin: string,
	token: string,
	listener: { name: string; timezone: string },
	episodes: FeedEpisode[]
): string {
	const title = xmlEscape(`Diffcast for ${listener.name}`)
	const image = xmlEscape(`${origin}/cover.png`)
	const link = xmlEscape(`${origin}/`)
	const items = episodes
		.slice(0, FEED_EPISODES)
		.map((episode) => feedItem(origin, token, listener.timezone, episode))
		.join('')
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
	<channel>
		<title>${title}</title>
		<link>${link}</link>
		<description>What changed in your corner of tech, on the days you picked.</description>
		<language>en-us</language>
		<itunes:author>Diffcast</itunes:author>
		<itunes:image href="${image}"/>
		<image>
			<url>${image}</url>
			<title>${title}</title>
			<link>${link}</link>
		</image>
		<itunes:block>Yes</itunes:block>
		<itunes:explicit>false</itunes:explicit>
		<podcast:locked>yes</podcast:locked>${items}
	</channel>
</rss>
`
}
