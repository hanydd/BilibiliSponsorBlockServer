BEGIN TRANSACTION;

ALTER TABLE "sponsorTimes" ADD "ytbID" TEXT;
ALTER TABLE "sponsorTimes" ADD "ytbSegmentUUID" TEXT;
ALTER TABLE "sponsorTimes" ADD "portUUID" TEXT;

CREATE TABLE IF NOT EXISTS "portVideo" (
	"bvID" TEXT NOT NULL,
	"ytbID" TEXT NOT NULL,
	"biliDuration" REAL NOT NULL,
	"ytbDuration" REAL NOT NULL,
	"UUID" TEXT NOT NULL PRIMARY KEY,
	"hidden" INTEGER NOT NULL default 0,
	"votes" INTEGER NOT NULL default 0,
	"locked" INTEGER NOT NULL default 0,
	"userID" TEXT NOT NULL,
	"timeSubmitted" INTEGER NOT NULL,
	"userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "portVideo_bvid"
    ON "portVideo" USING btree ("bvID" ASC, "hidden" ASC, "votes" ASC);

CREATE INDEX IF NOT EXISTS "portVideo_ytbid"
    ON "portVideo" USING btree ("ytbID" ASC, "hidden" ASC, "votes" ASC);

CREATE INDEX IF NOT EXISTS "sponsorTimes_portUUID"
    ON "sponsorTimes" USING btree ("portUUID" ASC);

UPDATE "config" SET value = 41 WHERE key = 'version';

COMMIT;
