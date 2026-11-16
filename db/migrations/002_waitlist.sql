CREATE TABLE waitlist (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	email text NOT NULL,
	podcast_app text,
	interests_text text NOT NULL DEFAULT '' CHECK (length(interests_text) <= 2000),
	stack_text text NOT NULL DEFAULT '' CHECK (length(stack_text) <= 20000),
	created_at timestamptz NOT NULL DEFAULT now(),
	invited_at timestamptz
);

CREATE UNIQUE INDEX waitlist_email ON waitlist (lower(email));
