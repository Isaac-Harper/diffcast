import { sql } from '../db'
import { SMOKE_MODEL } from '../business'
import type { BusinessCounts } from '../business'
import { servedListener } from './served'

export async function businessCounts(): Promise<BusinessCounts> {
	const rows = (await sql`
		WITH billing AS (
			SELECT l.comped, ${servedListener()} AS served FROM listeners l
		), costed AS (
			SELECT e.created_at,
				coalesce((e.metrics->>'llmCostUsd')::float8, 0) + coalesce((e.metrics->>'ttsCostUsd')::float8, 0)
					AS cost
			FROM episodes e
			WHERE coalesce(e.metrics->>'model', '') <> ${SMOKE_MODEL}
				AND e.created_at >= now() - interval '30 days'
		)
		SELECT
			(SELECT count(*)::int FROM billing WHERE served) AS served,
			(SELECT count(*)::int FROM billing WHERE served AND NOT comped) AS paying,
			(SELECT count(*)::int FROM billing WHERE served AND comped) AS comped,
			(SELECT count(*)::int FROM signups WHERE created_at >= date_trunc('week', now()))
				AS "signupsStarted",
			(SELECT count(*)::int FROM signups WHERE completed_at >= date_trunc('week', now()))
				AS "signupsCompleted",
			(SELECT count(*)::int FROM costed WHERE created_at >= date_trunc('day', now()))
				AS "episodesToday",
			(SELECT count(*)::int FROM job_runs WHERE status = 'fail' AND at >= date_trunc('day', now()))
				AS "failuresToday",
			(SELECT avg(cost) FROM costed WHERE created_at >= now() - interval '7 days') AS "averageCost7",
			(SELECT max(cost) FROM costed WHERE created_at >= now() - interval '7 days') AS "maxCost7",
			(SELECT coalesce(sum(cost), 0)::float8 FROM costed) AS "episodeCost30"
	`) as BusinessCounts[]
	const row = rows[0]
	if (!row) throw new Error('Business counts returned no row')
	return row
}
