BEGIN TRANSACTION;

ALTER TABLE "sponsorTimes" ADD "cid" TEXT;

UPDATE "config" SET value = 14 WHERE key = 'version';

COMMIT;