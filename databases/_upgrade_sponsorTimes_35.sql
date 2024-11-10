BEGIN TRANSACTION;

UPDATE "config" SET value = 35 WHERE key = 'version';

COMMIT;