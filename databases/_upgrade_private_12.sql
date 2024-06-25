BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "portVideo" (
	"bvID" TEXT NOT NULL,
	"UUID" TEXT PRIMARY KEY,
	"hashedIP" TEXT NOT NULL,
	"timeSubmitted" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "portVideoVotes" (
	"id" SERIAL PRIMARY KEY,
	"bvID" TEXT NOT NULL,
	"UUID" TEXT NOT NULL,
	"type" INTEGER NOT NULL,
	"originalType" INTEGER,
	"originalVotes" INTEGER,
	"userID" TEXT NOT NULL,
	"hashedIP" TEXT NOT NULL,
	"timeSubmitted" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "portVideoVotes_UUID"
    ON "portVideoVotes" USING btree ("UUID", "userID");


UPDATE "config" SET value = 12 WHERE key = 'version';

COMMIT;