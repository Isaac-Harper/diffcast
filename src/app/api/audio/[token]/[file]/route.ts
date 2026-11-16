import { signedAudioUrl } from '@/lib/blob'
import { checkFeedToken, feedMiss } from '@/lib/feed-access'
import { episodeIdFromFile, userAgent } from '@/lib/feed-tokens'
import { listenerEpisodeAudio, recordDownload } from '@/lib/store/episodes'

type Context = RouteContext<'/api/audio/[token]/[file]'>

async function serve(
	request: Request,
	{ params }: Context,
	operation: 'get' | 'head'
): Promise<Response> {
	const { token, file } = await params
	const access = await checkFeedToken(request, token)
	if (access instanceof Response) return access

	const episodeId = episodeIdFromFile(file)
	const url = episodeId === null ? null : await listenerEpisodeAudio(access.listenerId, episodeId)
	if (episodeId === null || !url) return feedMiss(request)

	if (operation === 'get') {
		await recordDownload(episodeId, access.id, userAgent(request.headers.get('user-agent')))
	}
	return new Response(null, {
		status: 302,
		headers: {
			location: await signedAudioUrl(url, operation),
			'cache-control': 'no-store',
			'referrer-policy': 'no-referrer',
		},
	})
}

export function GET(request: Request, context: Context): Promise<Response> {
	return serve(request, context, 'get')
}

export function HEAD(request: Request, context: Context): Promise<Response> {
	return serve(request, context, 'head')
}
