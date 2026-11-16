import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

function connection(): NeonQueryFunction<false, false> {
	if (!client) {
		const url = process.env['DATABASE_URL']
		if (!url) throw new Error('DATABASE_URL is not set')
		client = neon(url)
	}
	return client
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
	return connection()(strings, ...values)
}

export function transaction(queries: ReturnType<typeof sql>[]) {
	return connection().transaction(queries)
}
