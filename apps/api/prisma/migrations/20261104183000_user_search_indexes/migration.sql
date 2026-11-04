-- Case-insensitive user search uses ILIKE '%query%'. Trigram GIN indexes keep
-- that search efficient without loading all users into memory.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "User_name_trgm_idx"
  ON "User" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "User_username_trgm_idx"
  ON "User" USING GIN ("username" gin_trgm_ops);
