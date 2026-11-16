import { dueResponseSchema } from '@shared/contract'
import { checkJobRequest } from '@/lib/job-auth'
import { dueListeners } from '@/lib/jobs'

export async function GET(request: Request): Promise<Response> {
	const denied = await checkJobRequest(request)
	if (denied) return denied

	const given = new URL(request.url).searchParams.get('now')
	const now = given === null ? new Date() : new Date(given)
	if (Number.isNaN(now.getTime())) {
		return Response.json({ error: 'now must be an ISO instant.' }, { status: 400 })
	}

	const body = dueResponseSchema.parse({ listeners: await dueListeners(now) })
	return Response.json(body)
}
