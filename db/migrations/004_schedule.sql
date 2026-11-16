ALTER TABLE listeners
	ADD COLUMN days smallint[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}'
		CHECK (cardinality(days) > 0 AND days <@ '{1,2,3,4,5,6,7}'::smallint[]);
