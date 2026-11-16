import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CopyButton } from '@/app/components/copy-button'
import { SegmentList } from '@/app/components/segment-list'
import { Wordmark } from '@/app/components/wordmark'
import { feedAccess } from '@/lib/feed-access'
import { episodeAudioUrl, feedUrl } from '@/lib/feed-tokens'
import { FEED_EPISODES } from '@/lib/feed'
import { formatDate, formatMinutes } from '@/lib/format'
import { requestOrigin } from '@/lib/http'
import { listFeedEpisodes } from '@/lib/store/episodes'
import { latestFeedbackForListener, latestSurvey } from '@/lib/store/feedback'
import { getListener } from '@/lib/store/listeners'
import { forwardedIp } from '@/lib/throttle'
import { FeedbackForm, SurveyForm } from './forms'

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

	const [listener, episodes, feedback, survey] = await Promise.all([
		getListener(access.listenerId),
		listFeedEpisodes(access.listenerId, FEED_EPISODES),
		latestFeedbackForListener(access.listenerId),
		latestSurvey(access.listenerId),
	])
	if (!listener) notFound()
	const feed = feedUrl(requestOrigin(headerList), token)
	const feedbackByEpisode = new Map(feedback.map((row) => [row.episode_id, row]))

	return (
		<>
			<header className="space-y-1">
				<Wordmark className="text-sm" />
				<h1 className="text-title font-semibold text-balance">Diffcast for {listener.name}</h1>
			</header>

			<section className="card space-y-3" aria-labelledby="survey-heading">
				<h2 id="survey-heading" className="text-lg font-semibold">
					Would you pay $15 a month for this?
				</h2>
				<SurveyForm
					token={token}
					current={survey ? { wouldPay: survey.would_pay, note: survey.note } : null}
				/>
			</section>

			{/* INTERESTS SECTION: the listener's interests and takes go here after the interests branch merges. */}

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
					<p className="text-muted">No episodes yet. The first one lands on a weekday morning.</p>
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
