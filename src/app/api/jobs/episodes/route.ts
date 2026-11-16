import { episodeRequestSchema } from '@shared/contract'
import { deleteAudio } from '@/lib/blob'
import { blobStoreId, isBlobUrl } from '@/lib/blob-rules'
import { badJson, invalidBody, readJson } from '@/lib/http'
import { checkJobRequest } from '@/lib/job-auth'
import { upsertEpisode } from '@/lib/store/episodes'
import { listenerExists } from '@/lib/store/listeners'
import { recordRunOk } from '@/lib/store/runs'

export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
	const denied = await checkJobRequest(request)
	if (denied) return denied

	const json = await readJson(request)
	if (!json.ok) return badJson()
	const parsed = episodeRequestSchema.safeParse(json.body)
	if (!parsed.success) return invalidBody(parsed.error)
	const body = parsed.data

	const storeId = blobStoreId(process.env['BLOB_READ_WRITE_TOKEN'])
	if (!isBlobUrl(body.audioUrl, storeId, body.listenerId)) {
		return Response.json(
			{ error: `audioUrl must be a private Blob URL under /episodes/${body.listenerId}/.` },
			{ status: 400 }
		)
	}
	if (!(await listenerExists(body.listenerId))) {
		return Response.json({ error: 'Unknown listener.' }, { status: 404 })
	}

	const saved = await upsertEpisode(body)
	if (saved.oldAudioUrl && saved.oldAudioUrl !== body.audioUrl) await deleteAudio(saved.oldAudioUrl)
	await recordRunOk(body.listenerId, body.date, saved.replaced ? 'replaced' : 'saved')
	return Response.json({ id: saved.id, replaced: saved.replaced })
}
