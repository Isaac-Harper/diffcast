CREATE TABLE interests (
	id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	listener_id int NOT NULL REFERENCES listeners (id) ON DELETE CASCADE,
	topic text NOT NULL CHECK (length(topic) BETWEEN 1 AND 100),
	take text CHECK (length(take) <= 500),
	note text CHECK (length(note) <= 500),
	active boolean NOT NULL DEFAULT true,
	sort int NOT NULL DEFAULT 0,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX interests_listener_topic ON interests (listener_id, lower(topic));

INSERT INTO interests (listener_id, topic, sort)
SELECT l.id, d.topic, d.sort
FROM listeners l
CROSS JOIN (VALUES
	('AI models and agents', 0),
	('Developer tools and web development', 1),
	('Startups and the tech industry', 2),
	('Security and privacy', 3),
	('Open source', 4),
	('Hardware and chips', 5)
) AS d (topic, sort)
WHERE NOT EXISTS (SELECT 1 FROM interests i WHERE i.listener_id = l.id);
