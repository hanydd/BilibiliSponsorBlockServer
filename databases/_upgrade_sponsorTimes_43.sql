BEGIN TRANSACTION;

ALTER TABLE "sponsorTimes" ADD "cid" TEXT;
ALTER TABLE "portVideo" ADD "cid" TEXT;
ALTER TABLE "videoInfo" ADD "cid" TEXT;
ALTER TABLE "lockCategories" ADD "cid" TEXT;

UPDATE "config" SET value = 43 WHERE key = 'version';

COMMIT;
