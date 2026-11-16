import { sql } from '../db'
import { SERVED_STATUSES } from '../served'

export function servedListener() {
	return sql`(l.active AND (l.comped OR l.subscription_status = ANY(${[...SERVED_STATUSES]}::text[])))`
}
