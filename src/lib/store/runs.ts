import type { FailureRequest } from '@shared/contract'
import { sql } from '../db'

export interface JobRunRow {
	id: number
	listener_id: number
	listener_name: string
	run_on: string
	status: 'ok' | 'fail'
	step: string | null
	message: string
	at: string
}

export async function recordRunOk(
	listenerId: number,
	date: string,
	message: string
): Promise<void> {
	await sql`
		INSERT INTO job_runs (listener_id, run_on, status, step, message)
		VALUES (${listenerId}, ${date}::date, 'ok', NULL, ${message})
	`
}

export async function recordRunFailure(failure: FailureRequest): Promise<void> {
	await sql`
		INSERT INTO job_runs (listener_id, run_on, status, step, message)
		VALUES (${failure.listenerId}, ${failure.date}::date, 'fail', ${failure.step}, ${failure.message})
	`
}

export async function listJobRuns(limit: number): Promise<JobRunRow[]> {
	return (await sql`
		SELECT r.id, r.listener_id, l.name AS listener_name, r.run_on::text, r.status, r.step, r.message,
			r.at::text
		FROM job_runs r JOIN listeners l ON l.id = r.listener_id
		ORDER BY r.at DESC, r.id DESC LIMIT ${limit}
	`) as JobRunRow[]
}
