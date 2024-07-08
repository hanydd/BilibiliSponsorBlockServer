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


UPDATE "config" SET value = 41 WHERE key = 'version';

COMMIT;
