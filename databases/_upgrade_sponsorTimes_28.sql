BEGIN TRANSACTION;

UPDATE "config" SET value = 28 WHERE key = 'version';

COMMIT;