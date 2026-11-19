ALTER TABLE signups ADD COLUMN topics text[] NOT NULL DEFAULT '{}' CHECK (cardinality(topics) <= 40);
