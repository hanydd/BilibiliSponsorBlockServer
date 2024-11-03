BEGIN TRANSACTION;

ALTER TABLE "sponsorTimes" ADD "cid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "portVideo" ADD "cid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "videoInfo" ADD "cid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "lockCategories" ADD "cid" TEXT NOT NULL DEFAULT '';

UPDATE "config" SET value = 43 WHERE key = 'version';

COMMIT;
