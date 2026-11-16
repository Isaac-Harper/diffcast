CREATE TABLE listeners (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name text NOT NULL,
	email text,
	timezone text NOT NULL,
	stack jsonb NOT NULL DEFAULT '[]'::jsonb,
	focus text NOT NULL DEFAULT '' CHECK (length(focus) <= 2000),
	minutes int NOT NULL DEFAULT 10 CHECK (minutes BETWEEN 3 AND 20),
	active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feed_tokens (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	label text NOT NULL,
	token_hash text NOT NULL UNIQUE,
	created_at timestamptz NOT NULL DEFAULT now(),
	revoked_at timestamptz,
	last_fetched_at timestamptz,
	last_user_agent varchar(200),
	fetch_count int NOT NULL DEFAULT 0
);

CREATE INDEX feed_tokens_listener ON feed_tokens (listener_id);

CREATE TABLE episodes (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	published_on date NOT NULL,
	title text NOT NULL,
	summary text NOT NULL,
	story_count int NOT NULL,
	segments jsonb NOT NULL,
	turns jsonb NOT NULL,
	metrics jsonb NOT NULL,
	audio_url text NOT NULL,
	audio_bytes bigint NOT NULL,
	duration_seconds real NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (listener_id, published_on)
);

CREATE TABLE downloads (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	episode_id int NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
	feed_token_id int NOT NULL REFERENCES feed_tokens (id) ON DELETE CASCADE,
	at timestamptz NOT NULL DEFAULT now(),
	method text NOT NULL CHECK (method IN ('GET', 'HEAD')),
	user_agent varchar(200)
);

CREATE INDEX downloads_episode ON downloads (episode_id, feed_token_id, at DESC);

CREATE TABLE feedback (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	episode_id int NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
	listened text NOT NULL CHECK (listened IN ('yes', 'partly', 'no')),
	useful text CHECK (useful IN ('up', 'down')),
	note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_episode ON feedback (episode_id, created_at DESC);

CREATE TABLE surveys (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	would_pay text NOT NULL CHECK (would_pay IN ('yes', 'maybe', 'no')),
	note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX surveys_listener ON surveys (listener_id, created_at DESC);

CREATE TABLE segment_checks (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	episode_id int NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
	segment_index int NOT NULL CHECK (segment_index >= 0),
	verdict text NOT NULL CHECK (verdict IN ('correct', 'error', 'unclear')),
	note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
	checked_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (episode_id, segment_index)
);

CREATE TABLE job_runs (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	run_on date NOT NULL,
	status text NOT NULL CHECK (status IN ('ok', 'fail')),
	step text,
	message text NOT NULL DEFAULT '',
	at timestamptz NOT NULL DEFAULT now(),
	CHECK ((status = 'ok') = (step IS NULL))
);

CREATE INDEX job_runs_at ON job_runs (at DESC);
