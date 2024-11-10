BEGIN TRANSACTION;

UPDATE "config" SET value = 4 WHERE key = 'version';

COMMIT;