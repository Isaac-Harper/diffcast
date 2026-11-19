import type { Dependency } from '@shared/contract'
import { sql } from '../db'
import { SERVED_STATUSES } from '../served'
import type { SignupInput } from '../signup'

export interface SignupRow {
	id: number
	email: string
	timezone: string
	topics: string[]
	interests_text: string
	stack_text: string
	days: number[]
	listener_id: number | null
	completed_at: string | null
}

export interface SubscriptionState {
	subscriptionId: string
	status: string
	periodEnd: Date | null
	cancelAt: Date | null
	cancelRequestedAt: Date | null
}

export interface SubscriptionChange {
	listenerId: number
	email: string | null
	comped: boolean
	previousStatus: string | null
	status: string
	serviceEnded: boolean
}

function isoOrNull(date: Date | null): string | null {
	return date === null ? null : date.toISOString()
}

export interface PaidListener {
	id: number
	timezone: string
	days: number[]
}

export async function createSignup(input: SignupInput): Promise<number> {
	const rows = (await sql`
		INSERT INTO signups (email, timezone, topics, interests_text, stack_text, days)
		VALUES (${input.email}, ${input.timezone}, ${input.topics}::text[], ${input.interestsText},
			${input.stackText}, ${input.days}::smallint[])
		RETURNING id
	`) as { id: number }[]
	const row = rows[0]
	if (!row) throw new Error('Signup insert returned no row')
	return row.id
}

export async function attachCheckoutSession(signupId: number, sessionId: string): Promise<void> {
	await sql`
		UPDATE signups SET stripe_checkout_session_id = ${sessionId}
		WHERE id = ${signupId} AND stripe_checkout_session_id IS NULL
	`
}

export async function signupForSession(sessionId: string): Promise<SignupRow | null> {
	const rows = (await sql`
		SELECT id, email, timezone, topics, interests_text, stack_text, days, listener_id, completed_at::text
		FROM signups WHERE stripe_checkout_session_id = ${sessionId}
	`) as SignupRow[]
	return rows[0] ?? null
}

export async function upsertPaidListener(input: {
	signupId: number
	name: string
	email: string
	timezone: string
	focus: string
	topics: readonly string[]
	stack: Dependency[]
	days: number[]
	customerId: string
	subscription: SubscriptionState
}): Promise<PaidListener> {
	const rows = (await sql`
		WITH upserted AS (
			INSERT INTO listeners (name, email, timezone, stack, focus, days, stripe_customer_id,
				stripe_subscription_id, subscription_status, current_period_end, cancel_at,
				cancel_requested_at)
			VALUES (${input.name}, ${input.email}, ${input.timezone}, ${JSON.stringify(input.stack)}::jsonb,
				${input.focus}, ${input.days}::smallint[], ${input.customerId},
				${input.subscription.subscriptionId}, ${input.subscription.status},
				${isoOrNull(input.subscription.periodEnd)}::timestamptz,
				${isoOrNull(input.subscription.cancelAt)}::timestamptz,
				${isoOrNull(input.subscription.cancelRequestedAt)}::timestamptz)
			ON CONFLICT (stripe_customer_id) DO UPDATE SET
				stripe_subscription_id = EXCLUDED.stripe_subscription_id,
				subscription_status = EXCLUDED.subscription_status,
				current_period_end = EXCLUDED.current_period_end,
				cancel_at = EXCLUDED.cancel_at,
				cancel_requested_at = EXCLUDED.cancel_requested_at,
				service_ended_at = NULL
			RETURNING id, timezone, days, (xmax = 0) AS inserted
		), seeded AS (
			INSERT INTO interests (listener_id, topic, sort)
			SELECT upserted.id, picked.topic, (picked.sort - 1)::int
			FROM upserted, unnest(${[...input.topics]}::text[]) WITH ORDINALITY AS picked (topic, sort)
			WHERE upserted.inserted
		), linked AS (
			UPDATE signups SET listener_id = upserted.id FROM upserted
			WHERE signups.id = ${input.signupId}
		)
		SELECT id, timezone, days FROM upserted
	`) as PaidListener[]
	const row = rows[0]
	if (!row) throw new Error('Listener upsert returned no row')
	return row
}

export async function markSignupCompleted(signupId: number): Promise<void> {
	await sql`
		WITH completed AS (
			UPDATE signups SET completed_at = now() WHERE id = ${signupId} AND completed_at IS NULL
			RETURNING id
		)
		INSERT INTO events (kind) SELECT 'paid' FROM completed
	`
}

export async function listenerForSubscription(subscriptionId: string): Promise<number | null> {
	const rows = (await sql`
		SELECT id FROM listeners WHERE stripe_subscription_id = ${subscriptionId}
	`) as { id: number }[]
	return rows[0]?.id ?? null
}

export async function syncSubscription(
	state: SubscriptionState
): Promise<SubscriptionChange | null> {
	const served = (SERVED_STATUSES as readonly string[]).includes(state.status)
	const rows = (await sql`
		WITH previous AS (
			SELECT id, subscription_status, subscription_status = ANY(${[...SERVED_STATUSES]}::text[])
				AS was_served
			FROM listeners
			WHERE stripe_subscription_id = ${state.subscriptionId}
			FOR UPDATE
		)
		UPDATE listeners l SET subscription_status = ${state.status},
			current_period_end = ${isoOrNull(state.periodEnd)}::timestamptz,
			cancel_at = ${isoOrNull(state.cancelAt)}::timestamptz,
			cancel_requested_at = ${isoOrNull(state.cancelRequestedAt)}::timestamptz,
			service_ended_at = CASE
				WHEN ${served}::boolean THEN NULL
				WHEN coalesce(previous.was_served, false) AND NOT l.comped THEN now()
				ELSE l.service_ended_at
			END
		FROM previous WHERE l.id = previous.id
		RETURNING l.id AS "listenerId", l.email, l.comped,
			previous.subscription_status AS "previousStatus", l.subscription_status AS status,
			(coalesce(previous.was_served, false) AND NOT ${served}::boolean AND NOT l.comped)
				AS "serviceEnded"
	`) as SubscriptionChange[]
	return rows[0] ?? null
}

export async function welcomeListener(
	sessionId: string,
	customerId: string
): Promise<{ listenerId: number; shown: boolean } | null> {
	const rows = (await sql`
		SELECT s.listener_id AS "listenerId", s.welcome_shown_at IS NOT NULL AS shown
		FROM signups s JOIN listeners l ON l.id = s.listener_id
		WHERE s.stripe_checkout_session_id = ${sessionId} AND l.stripe_customer_id = ${customerId}
	`) as { listenerId: number; shown: boolean }[]
	return rows[0] ?? null
}

export async function claimWelcome(sessionId: string, customerId: string): Promise<number | null> {
	const rows = (await sql`
		UPDATE signups s SET welcome_shown_at = now() FROM listeners l
		WHERE s.stripe_checkout_session_id = ${sessionId} AND s.listener_id = l.id
			AND l.stripe_customer_id = ${customerId} AND s.welcome_shown_at IS NULL
		RETURNING l.id
	`) as { id: number }[]
	return rows[0]?.id ?? null
}

export async function recordStripeEvent(id: string, type: string): Promise<boolean> {
	const rows = (await sql`
		INSERT INTO stripe_events (id, type) VALUES (${id}, ${type})
		ON CONFLICT (id) DO NOTHING RETURNING id
	`) as { id: string }[]
	return rows.length > 0
}

export async function forgetStripeEvent(id: string): Promise<void> {
	await sql`DELETE FROM stripe_events WHERE id = ${id}`
}

export async function returningCustomer(email: string): Promise<string | null> {
	const rows = (await sql`
		SELECT stripe_customer_id FROM listeners
		WHERE lower(email) = lower(${email}) AND stripe_customer_id IS NOT NULL
		ORDER BY id DESC LIMIT 1
	`) as { stripe_customer_id: string }[]
	return rows[0]?.stripe_customer_id ?? null
}
