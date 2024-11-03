BEGIN TRANSACTION;

ALTER TABLE "sponsorTimes" ADD "cid" TEXT NOT NULL DEFAULT '';

UPDATE "config" SET value = 14 WHERE key = 'version';

COMMIT;