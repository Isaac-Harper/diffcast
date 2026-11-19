CREATE TABLE events (
	id bigserial PRIMARY KEY,
	kind text NOT NULL CHECK (
		kind IN ('landing_view', 'sample_play', 'signup_start', 'checkout_start', 'paid', 'cancel')
	),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_kind_created_at ON events (kind, created_at);
