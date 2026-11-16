ALTER TABLE listeners ADD COLUMN session_epoch int NOT NULL DEFAULT 0 CHECK (session_epoch >= 0);
