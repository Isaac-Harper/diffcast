CREATE TABLE oauth_clients (
	id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 2000),
	kind text NOT NULL CHECK (kind IN ('registered', 'metadata_document')),
	name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
	redirect_uris text[] NOT NULL CHECK (cardinality(redirect_uris) BETWEEN 1 AND 10),
	created_at timestamptz NOT NULL DEFAULT now(),
	cache_until timestamptz,
	CHECK ((kind = 'metadata_document') = (cache_until IS NOT NULL))
);

CREATE TABLE oauth_grants (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	client_id text NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
	resource text NOT NULL,
	scope text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	last_used_at timestamptz,
	revoked_at timestamptz
);

CREATE INDEX oauth_grants_listener ON oauth_grants (listener_id, created_at DESC);

CREATE TABLE oauth_codes (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	code_hash text NOT NULL UNIQUE,
	client_id text NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	redirect_uri text NOT NULL,
	code_challenge text NOT NULL,
	resource text NOT NULL,
	scope text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	used_at timestamptz,
	grant_id int REFERENCES oauth_grants (id) ON DELETE CASCADE
);

CREATE TABLE oauth_tokens (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	token_hash text NOT NULL UNIQUE,
	kind text NOT NULL CHECK (kind IN ('access', 'refresh')),
	grant_id int NOT NULL REFERENCES oauth_grants (id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	revoked_at timestamptz
);

CREATE INDEX oauth_tokens_grant ON oauth_tokens (grant_id);

CREATE TABLE work_context (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	project text NOT NULL CHECK (length(project) BETWEEN 1 AND 80),
	packages text[] NOT NULL DEFAULT '{}' CHECK (cardinality(packages) <= 200),
	topics text[] NOT NULL DEFAULT '{}' CHECK (cardinality(topics) <= 20),
	summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 300),
	updated_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	UNIQUE (listener_id, project)
);

CREATE TABLE mcp_usage (
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	day date NOT NULL,
	push_count int NOT NULL DEFAULT 0,
	PRIMARY KEY (listener_id, day)
);
