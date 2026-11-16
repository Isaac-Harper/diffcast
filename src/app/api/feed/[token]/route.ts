import { checkFeedToken } from '@/lib/feed-access'
import { userAgent } from '@/lib/feed-tokens'
import { buildFeed, FEED_EPISODES } from '@/lib/feed'
import { listFeedEpisodes } from '@/lib/store/episodes'
import { recordFeedFetch } from '@/lib/store/feed-tokens'
import { getListener } from '@/lib/store/listeners'

export async function GET(
	request: Request,
	{ params }: RouteContext<'/api/feed/[token]'>
): Promise<Response> {
	const { token } = await params
	const access = await checkFeedToken(request, token)
	if (access instanceof Response) return access

	const [listener, episodes] = await Promise.all([
		getListener(access.listenerId),
		listFeedEpisodes(access.listenerId, FEED_EPISODES),
		recordFeedFetch(access.id, userAgent(request.headers.get('user-agent'))),
	])
	if (!listener) throw new Error(`Feed token ${access.id} points at a missing listener`)

	return new Response(buildFeed(new URL(request.url).origin, token, listener, episodes), {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'private, max-age=300',
		},
	})
}
