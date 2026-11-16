ALTER TABLE listeners
	ADD COLUMN stripe_customer_id text UNIQUE,
	ADD COLUMN stripe_subscription_id text UNIQUE,
	ADD COLUMN subscription_status text,
	ADD COLUMN current_period_end timestamptz,
	ADD COLUMN comped boolean NOT NULL DEFAULT false;

UPDATE listeners SET comped = true;

CREATE INDEX listeners_email ON listeners (lower(email));

CREATE TABLE signups (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	email text NOT NULL CHECK (length(email) <= 320),
	timezone text NOT NULL,
	interests_text text NOT NULL DEFAULT '' CHECK (length(interests_text) <= 2000),
	stack_text text NOT NULL DEFAULT '' CHECK (length(stack_text) <= 20000),
	days smallint[] NOT NULL
		CHECK (cardinality(days) > 0 AND days <@ '{1,2,3,4,5,6,7}'::smallint[]),
	stripe_checkout_session_id text UNIQUE,
	listener_id int REFERENCES listeners (id) ON DELETE SET NULL,
	welcome_shown_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	completed_at timestamptz
);

CREATE INDEX signups_created ON signups (created_at DESC);

CREATE TABLE login_tokens (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	token_hash text NOT NULL UNIQUE,
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	used_at timestamptz
);

CREATE TABLE stripe_events (
	id text PRIMARY KEY,
	type text NOT NULL,
	received_at timestamptz NOT NULL DEFAULT now()
);

DROP TABLE waitlist;
