import { mkdir, readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dataDir = process.argv[2]
const port = Number(process.env.LOCAL_DB_PORT ?? 4444)
if (!dataDir) {
	console.error('Usage: node scripts/local-db/server.mjs <data dir>')
	process.exit(1)
}

await mkdir(dataDir, { recursive: true })
const db = await PGlite.create(dataDir)

await db.exec(
	'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
)
const applied = new Set(
	(await db.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name)
)
const migrations = path.join(root, 'db', 'migrations')
for (const name of (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort()) {
	if (applied.has(name)) continue
	await db.transaction(async (tx) => {
		await tx.exec(await readFile(path.join(migrations, name), 'utf8'))
		await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
	})
	console.log(`applied ${name}`)
}

const rawText = Object.fromEntries(
	(await db.query('SELECT oid FROM pg_type')).rows.map((row) => [row.oid, (value) => value])
)

async function run(executor, { query, params }) {
	const result = await executor.query(query, params ?? [], { rowMode: 'array', parsers: rawText })
	return {
		command: query.trim().split(/\s+/)[0]?.toUpperCase() ?? '',
		rowCount: result.affectedRows ?? result.rows.length,
		fields: result.fields.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })),
		rows: result.rows,
		rowAsArray: true,
	}
}

async function body(request) {
	const chunks = []
	for await (const chunk of request) chunks.push(chunk)
	return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

createServer(async (request, response) => {
	try {
		if (request.method !== 'POST' || request.url !== '/sql') {
			response.writeHead(404).end()
			return
		}
		const payload = await body(request)
		const result = Array.isArray(payload.queries)
			? {
					results: await db.transaction(async (tx) => {
						const results = []
						for (const query of payload.queries) results.push(await run(tx, query))
						return results
					}),
				}
			: await run(db, payload)
		response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result))
	} catch (error) {
		response
			.writeHead(400, { 'content-type': 'application/json' })
			.end(JSON.stringify({ message: error.message, code: error.code }))
	}
}).listen(port, '127.0.0.1', () => console.log(`local Neon HTTP stand-in on 127.0.0.1:${port}`))
