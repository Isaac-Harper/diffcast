export function extractEpisodeJson(reply: string): unknown {
	let text = reply.trim()
	const fence = text.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?\s*```$/)
	if (fence?.[1] !== undefined) text = fence[1].trim()
	if (!text.startsWith('{')) throw new Error('reply was not a JSON object')
	try {
		return JSON.parse(text)
	} catch (error) {
		throw new Error(
			`reply was not valid JSON: ${error instanceof Error ? error.message : String(error)}`
		)
	}
}
