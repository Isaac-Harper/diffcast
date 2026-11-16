import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@neondatabase/serverless'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(path.join(root, file))
	} catch {}
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
	console.error('DATABASE_URL is not set (expected in .env.local)')
	process.exit(1)
}

const dir = path.join(root, 'db', 'migrations')
const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()

const client = new Client(url)
await client.connect()

try {
	await client.query(
		'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
	)
	const applied = new Set(
		(await client.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name)
	)

	for (const name of files) {
		if (applied.has(name)) {
			console.warn(`skip   ${name}`)
			continue
		}
		const text = await readFile(path.join(dir, name), 'utf8')
		await client.query('BEGIN')
		try {
			await client.query(text)
			await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
			await client.query('COMMIT')
		} catch (error) {
			await client.query('ROLLBACK')
			throw new Error(`${name} failed: ${error instanceof Error ? error.message : error}`)
		}
		console.warn(`apply  ${name}`)
	}
} finally {
	await client.end()
}
