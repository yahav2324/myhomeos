UPDATE "AuthSession"
SET "expiresAt" = COALESCE("expiresAt", "createdAt" + INTERVAL '30 days')
WHERE "expiresAt" IS NULL;
