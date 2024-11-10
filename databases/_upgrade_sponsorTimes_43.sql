BEGIN TRANSACTION;

ALTER TABLE "sponsorTimes" ADD "cid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "portVideo" ADD "cid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "archivedSponsorTimes" ADD "cid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "lockCategories" ADD "cid" TEXT NOT NULL DEFAULT '';

ALTER TABLE "archivedSponsorTimes" ADD "ytbID" TEXT;
ALTER TABLE "archivedSponsorTimes" ADD "ytbSegmentUUID" TEXT;
ALTER TABLE "archivedSponsorTimes" ADD "portUUID" TEXT;

CREATE TABLE "sqlb_temp_table_43" (
	"videoID"	TEXT NOT NULL,
	"cid"	    TEXT NOT NULL DEFAULT '',
	"channelID"	TEXT NOT NULL,
	"title"	    TEXT NOT NULL,
	"published"	NUMERIC NOT NULL,
	PRIMARY KEY("videoID", "cid")
);

INSERT INTO sqlb_temp_table_43 SELECT "videoID", '', "channelID", "title", "published" FROM "videoInfo";

DROP TABLE "videoInfo";
ALTER TABLE sqlb_temp_table_43 RENAME TO "videoInfo";

UPDATE "config" SET value = 43 WHERE key = 'version';

COMMIT;
