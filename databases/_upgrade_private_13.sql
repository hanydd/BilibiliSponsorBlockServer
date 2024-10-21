BEGIN TRANSACTION;

DROP INDEX IF EXISTS "ratings_videoID";

DROP TABLE IF EXISTS "thumbnailVotes";
DROP TABLE IF EXISTS "titleVotes";
DROP TABLE IF EXISTS "ratings";

UPDATE "config" SET value = 13 WHERE key = 'version';

COMMIT;