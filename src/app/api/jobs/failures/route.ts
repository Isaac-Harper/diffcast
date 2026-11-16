import { failureRequestSchema } from '@shared/contract'
import { badJson, invalidBody, readJson } from '@/lib/http'
import { checkJobRequest } from '@/lib/job-auth'
import { listenerExists } from '@/lib/store/listeners'
import { recordRunFailure } from '@/lib/store/runs'

export async function POST(request: Request): Promise<Response> {
	const denied = await checkJobRequest(request)
	if (denied) return denied

	const json = await readJson(request)
	if (!json.ok) return badJson()
	const parsed = failureRequestSchema.safeParse(json.body)
	if (!parsed.success) return invalidBody(parsed.error)

	if (!(await listenerExists(parsed.data.listenerId))) {
		return Response.json({ error: 'Unknown listener.' }, { status: 404 })
	}
	await recordRunFailure(parsed.data)
	return Response.json({ ok: true })
}
