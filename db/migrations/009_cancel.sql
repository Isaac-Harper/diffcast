ALTER TABLE listeners
	ADD COLUMN cancel_at timestamptz,
	ADD COLUMN cancel_requested_at timestamptz,
	ADD COLUMN service_ended_at timestamptz;

UPDATE listeners SET service_ended_at = coalesce(current_period_end, now())
WHERE NOT comped AND subscription_status IS NOT NULL
	AND subscription_status NOT IN ('active', 'past_due');
