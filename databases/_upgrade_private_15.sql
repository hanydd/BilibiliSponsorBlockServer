BEGIN TRANSACTION;

ALTER TABLE "portVideo" ADD "cid" TEXT NOT NULL DEFAULT '';

UPDATE "config" SET value = 15 WHERE key = 'version';

COMMIT;