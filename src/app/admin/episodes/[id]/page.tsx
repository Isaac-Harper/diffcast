import { SPEAKER_NAMES } from '@shared/contract'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SegmentList } from '@/app/components/segment-list'
import { blobConfigured, signedAudioUrl } from '@/lib/blob'
import { formatDate, formatInstant, formatMinutes, formatUsd } from '@/lib/format'
import { wholeId } from '@/lib/forms'
import { getEpisode } from '@/lib/store/episodes'
import { downloadsForEpisode, feedbackForEpisode, segmentChecks } from '@/lib/store/feedback'
import { CheckForm } from '../check-form'
import { requireSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Episode' }

export default async function EpisodePage({ params }: PageProps<'/admin/episodes/[id]'>) {
	await requireSession()
	const id = wholeId((await params).id)
	const episode = id === null ? null : await getEpisode(id)
	if (!episode) notFound()
	const [checks, downloads, feedback, audio] = await Promise.all([
		segmentChecks(episode.id),
		downloadsForEpisode(episode.id),
		feedbackForEpisode(episode.id),
		blobConfigured() ? signedAudioUrl(episode.audio_url, 'get') : Promise.resolve(null),
	])
	const checkByIndex = new Map(checks.map((check) => [check.segment_index, check]))
	const metrics = episode.metrics

	return (
		<div className="max-w-3xl space-y-8">
			<header className="space-y-1">
				<p className="font-mono text-xs text-muted">
					<Link href={`/admin/listeners/${episode.listener_id}`} className="underline">
						{episode.listener_name}
					</Link>{' '}
					· {formatDate(episode.published_on)} · {formatMinutes(episode.duration_seconds)} ·{' '}
					{episode.story_count} stories
				</p>
				<h1 className="text-xl font-semibold text-balance">{episode.title}</h1>
			</header>

			{audio ? (
				<audio controls preload="none" src={audio} className="w-full" />
			) : (
				<p className="text-sm text-muted">Audio needs BLOB_READ_WRITE_TOKEN.</p>
			)}

			<p className="text-pretty">{episode.summary}</p>

			<dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
				{[
					['Model', metrics.model],
					['Tokens', `${metrics.inputTokens} in / ${metrics.outputTokens} out`],
					['Searches', String(metrics.webSearches)],
					['Fetches', String(metrics.webFetches)],
					['TTS characters', String(metrics.ttsCharacters)],
					['LLM cost', formatUsd(metrics.llmCostUsd)],
					['TTS cost', formatUsd(metrics.ttsCostUsd)],
					['Total cost', formatUsd(metrics.llmCostUsd + metrics.ttsCostUsd)],
					['Research', `${Math.round(metrics.researchSeconds)} s`],
					['Saved', formatInstant(episode.created_at)],
				].map(([label, value]) => (
					<div key={label} className="card">
						<dt className="font-mono text-xs text-muted">{label}</dt>
						<dd className="mt-1 font-medium break-words tabular-nums">{value}</dd>
					</div>
				))}
			</dl>

			<section className="space-y-4" aria-labelledby="segments-heading">
				<h2 id="segments-heading" className="text-lg font-semibold">
					Segments
				</h2>
				{episode.segments.map((segment, index) => {
					const check = checkByIndex.get(index)
					return (
						<div key={segment.heading} className="card space-y-3">
							<p className="font-mono text-xs text-muted uppercase">{segment.kind}</p>
							<SegmentList segments={[segment]} />
							<CheckForm
								episodeId={episode.id}
								segmentIndex={index}
								segmentHeading={segment.heading}
								current={check ? { verdict: check.verdict, note: check.note } : null}
							/>
						</div>
					)
				})}
			</section>

			<section className="space-y-2" aria-labelledby="feedback-heading">
				<h2 id="feedback-heading" className="text-lg font-semibold">
					Feedback
				</h2>
				{feedback.length === 0 && <p className="text-sm text-muted">None yet.</p>}
				<ul className="space-y-2 text-sm">
					{feedback.map((row, index) => (
						<li key={`${row.created_at}-${row.listened}`} className="card">
							<p className="font-mono text-xs text-muted">
								{formatInstant(row.created_at)} · listened {row.listened}
								{row.useful ? ` · ${row.useful === 'up' ? 'useful' : 'not useful'}` : ''}
								{index === 0 ? ' · latest' : ''}
							</p>
							{row.note && <p className="mt-1 whitespace-pre-wrap">{row.note}</p>}
						</li>
					))}
				</ul>
			</section>

			<section className="space-y-2" aria-labelledby="downloads-heading">
				<h2 id="downloads-heading" className="text-lg font-semibold">
					Downloads
				</h2>
				{downloads.length === 0 && <p className="text-sm text-muted">None yet.</p>}
				{downloads.length > 0 && (
					<div className="table-frame">
						<table className="data-table">
							<thead>
								<tr>
									<th>At</th>
									<th>Token</th>
									<th>Client</th>
								</tr>
							</thead>
							<tbody>
								{downloads.map((row) => (
									<tr key={`${row.at}-${row.label}-${row.user_agent ?? ''}`}>
										<td className="whitespace-nowrap">{formatInstant(row.at)}</td>
										<td>{row.label}</td>
										<td className="max-w-64 truncate font-mono text-xs">{row.user_agent ?? ''}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="space-y-2" aria-labelledby="transcript-heading">
				<h2 id="transcript-heading" className="text-lg font-semibold">
					Transcript
				</h2>
				<div className="space-y-3 text-sm">
					{episode.turns.map((turn, index) => (
						<p key={`${index}-${turn.speaker}`} className="text-pretty">
							<span className="font-medium">{SPEAKER_NAMES[turn.speaker]}:</span> {turn.text}
						</p>
					))}
				</div>
			</section>
		</div>
	)
}
