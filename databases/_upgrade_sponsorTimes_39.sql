BEGIN TRANSACTION;

UPDATE "config" SET value = 39 WHERE key = 'version';

COMMIT;
