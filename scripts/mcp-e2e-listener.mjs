import { createHmac } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@neondatabase/serverless'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(path.join(root, file))
	} catch {}
}

const NAME = 'MCP E2E'
const EMAIL = 'mcp-e2e@diffcast.fm'
const CLIENT_NAME = 'Diffcast e2e'
const SESSION_SECONDS = 60 * 60

const [command, cookieFile] = process.argv.slice(2)
if (command !== 'create' && command !== 'delete') {
	throw new Error('Usage: node scripts/mcp-e2e-listener.mjs create <cookie-file> | delete')
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const secret = process.env.DIFFCAST_SESSION_SECRET
if (!secret || secret.length < 32) throw new Error('DIFFCAST_SESSION_SECRET is not set')

function sessionCookie(listenerId, epoch) {
	const key = createHmac('sha256', secret).update('diffcast-listener-session').digest('base64url')
	const payload = `${listenerId}.${epoch}.${Date.now() + SESSION_SECONDS * 1000}`
	return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`
}

const client = new Client(url)
await client.connect()
try {
	if (command === 'create') {
		if (!cookieFile) throw new Error('create needs a file to write the session cookie to')
		const existing = await client.query('SELECT id FROM listeners WHERE email = $1', [EMAIL])
		if (existing.rows.length > 0) throw new Error(`${EMAIL} already exists; run delete first`)
		const created = await client.query(
			`INSERT INTO listeners (name, email, timezone, comped, active) VALUES ($1, $2, 'UTC', true, true)
			RETURNING id, session_epoch`,
			[NAME, EMAIL]
		)
		const { id, session_epoch: epoch } = created.rows[0]
		await client.query(
			`INSERT INTO interests (listener_id, topic, sort) VALUES ($1, 'Developer tools and web development', 0)`,
			[id]
		)
		await writeFile(cookieFile, sessionCookie(id, epoch), { mode: 0o600 })
		console.warn(`created listener ${id} (${NAME}); session cookie written to ${cookieFile}`)
	} else {
		const deleted = await client.query('DELETE FROM listeners WHERE email = $1 RETURNING id', [
			EMAIL,
		])
		const clients = await client.query(
			`DELETE FROM oauth_clients c WHERE c.name = $1
				AND NOT EXISTS (SELECT 1 FROM oauth_grants g WHERE g.client_id = c.id) RETURNING id`,
			[CLIENT_NAME]
		)
		console.warn(
			`deleted ${deleted.rows.length} listener(s) with everything they own, and ${clients.rows.length} e2e client(s)`
		)
	}
} finally {
	await client.end()
}
