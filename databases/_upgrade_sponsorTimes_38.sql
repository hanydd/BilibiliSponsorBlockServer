BEGIN TRANSACTION;

UPDATE "config" SET value = 38 WHERE key = 'version';

COMMIT;
