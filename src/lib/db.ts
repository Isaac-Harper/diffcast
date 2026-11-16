import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
	if (!client) {
		const url = process.env['DATABASE_URL']
		if (!url) throw new Error('DATABASE_URL is not set')
		client = neon(url)
	}
	return client(strings, ...values)
}
