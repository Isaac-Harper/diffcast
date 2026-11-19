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
if (!url) throw new Error('DATABASE_URL is not set')

const YESTERDAY = `((now() AT TIME ZONE 'America/Los_Angeles')::date - 1)`
const onYesterday = (column) =>
	`(${column} AT TIME ZONE 'America/Los_Angeles')::date = ${YESTERDAY}`

const client = new Client(url)
await client.connect()
try {
	await client.query('BEGIN TRANSACTION READ ONLY')
	const count = async (text) => Number((await client.query(text)).rows[0].count)
	const day = (await client.query(`SELECT ${YESTERDAY}::text AS day`)).rows[0].day
	const hasEvents = (
		await client.query(`SELECT to_regclass('public.events') IS NOT NULL AS present`)
	).rows[0].present
	const events = async (kind) =>
		hasEvents
			? String(
					await count(
						`SELECT count(*) FROM events WHERE kind = '${kind}' AND ${onYesterday('created_at')}`
					)
				)
			: 'n/a'
	const visits = await events('landing_view')
	const signups = await count(`SELECT count(*) FROM signups WHERE ${onYesterday('created_at')}`)
	const checkouts = await count(
		`SELECT count(*) FROM signups
		WHERE stripe_checkout_session_id IS NOT NULL AND ${onYesterday('created_at')}`
	)
	const paidNow = await count(
		`SELECT count(*) FROM listeners
		WHERE NOT comped AND subscription_status IN ('active', 'past_due')`
	)
	const paidYesterday = await count(
		`SELECT count(*) FROM signups WHERE ${onYesterday('completed_at')}`
	)
	const churned = await events('cancel')
	await client.query('ROLLBACK')
	if (!hasEvents)
		console.error('events table missing (migration 008 not applied): visits and churned are n/a')
	console.error(`day ${day} (America/Los_Angeles)`)
	console.log(
		`visits ${visits}, signups ${signups}, checkouts ${checkouts}, paid ${paidNow} (+${paidYesterday}), churned ${churned}`
	)
} finally {
	await client.end()
}
