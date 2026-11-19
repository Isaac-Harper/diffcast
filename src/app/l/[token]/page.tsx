import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CopyButton } from '@/app/components/copy-button'
import { DaysForm, InterestsForm } from '@/app/components/listener-settings'
import { NextEpisode } from '@/app/components/next-episode'
import { SegmentList } from '@/app/components/segment-list'
import { Wordmark } from '@/app/components/wordmark'
import { feedAccess } from '@/lib/feed-access'
import { episodeAudioUrl, feedUrl } from '@/lib/feed-tokens'
import { FEED_EPISODES } from '@/lib/feed'
import { formatDate, formatMinutes } from '@/lib/format'
import { requestOrigin } from '@/lib/http'
import { listFeedEpisodes } from '@/lib/store/episodes'
import { latestFeedbackForListener } from '@/lib/store/feedback'
import { listInterests } from '@/lib/store/interests'
import { getListener } from '@/lib/store/listeners'
import { forwardedIp } from '@/lib/throttle'
import { saveMyDays, saveMyInterests } from './actions'
import { FeedbackForm, SignInLinkForm } from './forms'

export const metadata: Metadata = {
	title: 'Your Diffcast',
	robots: { index: false, follow: false },
	referrer: 'no-referrer',
}

async function ListenerView({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params
	const headerList = await headers()
	const access = await feedAccess(forwardedIp(headerList.get('x-forwarded-for')), token)
	if (typeof access === 'number') notFound()

	const [listener, episodes, feedback, interests] = await Promise.all([
		getListener(access.listenerId),
		listFeedEpisodes(access.listenerId, FEED_EPISODES),
		latestFeedbackForListener(access.listenerId),
		listInterests(access.listenerId),
	])
	if (!listener) notFound()
	const feed = feedUrl(requestOrigin(headerList), token)
	const feedbackByEpisode = new Map(feedback.map((row) => [row.episode_id, row]))

	return (
		<>
			<header className="space-y-1">
				<Wordmark className="text-sm" />
				<h1 className="text-title font-semibold text-balance">Diffcast for {listener.name}</h1>
				<SignInLinkForm token={token} />
			</header>

			<section className="card" aria-label="Next episode">
				<NextEpisode
					listener={listener}
					latestEpisodeDate={episodes[0]?.published_on ?? null}
					label={episodes.length === 0 ? 'Your first episode' : 'Your next episode'}
				/>
			</section>

			<section className="card space-y-3" aria-labelledby="interests-heading">
				<h2 id="interests-heading" className="font-medium">
					What your episodes cover
				</h2>
				<InterestsForm action={saveMyInterests} hidden={{ token }} interests={interests} />
			</section>

			<section className="card space-y-3" aria-labelledby="days-heading">
				<h2 id="days-heading" className="font-medium">
					When episodes arrive
				</h2>
				<DaysForm action={saveMyDays} hidden={{ token }} days={listener.days} />
			</section>

			<section className="card space-y-2 text-sm" aria-labelledby="feed-heading">
				<h2 id="feed-heading" className="text-lg font-semibold">
					Listen in your podcast app
				</h2>
				<div className="flex items-center gap-2">
					<code className="code-chip">{feed}</code>
					<CopyButton value={feed} label="feed URL" />
				</div>
				<p className="text-pretty text-muted">
					Apple Podcasts: Library, the ••• menu, Follow a Show by URL, then paste. Overcast: the +
					button, Add URL, then paste. Keep this link private; it is your key.
				</p>
			</section>

			<section className="space-y-6" aria-label="Episodes">
				{episodes.length === 0 && (
					<p className="card text-pretty text-muted">
						No episodes yet. Add the feed above to your podcast app and the first one downloads on
						its own. Topic and day changes count until the episode is made.
					</p>
				)}
				{episodes.map((episode) => {
					const current = feedbackByEpisode.get(episode.id)
					return (
						<article key={episode.id} className="card space-y-4">
							<header className="space-y-1">
								<p className="font-mono text-xs text-muted tabular-nums">
									{formatDate(episode.published_on)} · {formatMinutes(episode.duration_seconds)}
								</p>
								<h2 className="text-lg font-semibold text-balance">{episode.title}</h2>
							</header>
							<audio
								controls
								preload="none"
								src={episodeAudioUrl('', token, episode.id)}
								className="w-full"
							/>
							<p className="text-pretty">{episode.summary}</p>
							<SegmentList segments={episode.segments} />
							<FeedbackForm
								token={token}
								episodeId={episode.id}
								episodeDate={formatDate(episode.published_on)}
								current={
									current
										? { listened: current.listened, useful: current.useful, note: current.note }
										: null
								}
							/>
						</article>
					)
				})}
			</section>
		</>
	)
}

export default function ListenerPage({ params }: PageProps<'/l/[token]'>) {
	return (
		<main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
			<Suspense fallback={<p className="text-muted">Loading…</p>}>
				<ListenerView params={params} />
			</Suspense>
		</main>
	)
}
