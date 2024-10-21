BEGIN TRANSACTION;

DROP TABLE IF EXISTS "thumbnails" CASCADE; --!sqlite-ignore
DROP TABLE IF EXISTS "thumbnails";
DROP TABLE IF EXISTS "thumbnailTimestamps";
DROP TABLE IF EXISTS "thumbnailVotes";
DROP TABLE IF EXISTS "titles" CASCADE; --!sqlite-ignore
DROP TABLE IF EXISTS "titles";
DROP TABLE IF EXISTS "titleVotes";
DROP TABLE IF EXISTS "ratings";

UPDATE "config" SET value = 42 WHERE key = 'version';

COMMIT;
