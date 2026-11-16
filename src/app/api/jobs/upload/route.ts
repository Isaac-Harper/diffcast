import { uploadRequestSchema } from '@shared/contract'
import { audioUploadToken, blobConfigured } from '@/lib/blob'
import { badJson, invalidBody, readJson } from '@/lib/http'
import { checkJobRequest } from '@/lib/job-auth'
import { listenerExists } from '@/lib/store/listeners'

export async function POST(request: Request): Promise<Response> {
	const denied = await checkJobRequest(request)
	if (denied) return denied

	if (!blobConfigured()) {
		return Response.json({ error: 'BLOB_READ_WRITE_TOKEN is not set.' }, { status: 503 })
	}

	const json = await readJson(request)
	if (!json.ok) return badJson()
	const parsed = uploadRequestSchema.safeParse(json.body)
	if (!parsed.success) return invalidBody(parsed.error)

	if (!(await listenerExists(parsed.data.listenerId))) {
		return Response.json({ error: 'Unknown listener.' }, { status: 404 })
	}
	return Response.json(await audioUploadToken(parsed.data.listenerId, parsed.data.date))
}
