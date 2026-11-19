import { parseBrowserEvent } from '@/lib/events'
import { recordEvent } from '@/lib/store/events'
import { Throttle, requestIp } from '@/lib/throttle'

const browserEvents = new Throttle(30, 10 * 60_000)

export async function POST(request: Request): Promise<Response> {
	const ip = requestIp(request)
	if (browserEvents.blocked(ip)) return new Response(null, { status: 429 })
	const kind = parseBrowserEvent(await request.json().catch(() => null))
	if (kind === null) return new Response(null, { status: 400 })
	browserEvents.add(ip)
	await recordEvent(kind)
	return new Response(null, { status: 204 })
}
