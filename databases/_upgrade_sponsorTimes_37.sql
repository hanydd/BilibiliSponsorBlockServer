BEGIN TRANSACTION;

UPDATE "config" SET value = 37 WHERE key = 'version';

COMMIT;