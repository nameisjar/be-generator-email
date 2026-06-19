-- Add `domain` column to aliases (per-alias domain, supports multi-domain like algonova.my.id + yumi.my.id)
-- 1) Add column with default so existing rows are backfilled.
ALTER TABLE "aliases" ADD COLUMN "domain" TEXT NOT NULL DEFAULT 'algonova.my.id';

-- 2) Drop the global unique index on `address`; replace with composite (address, domain).
DROP INDEX IF EXISTS "aliases_address_key";

-- 3) Composite unique — the same local part can exist on different domains.
CREATE UNIQUE INDEX "aliases_address_domain_key" ON "aliases"("address", "domain");

-- 4) Index for filtering by domain.
CREATE INDEX "aliases_domain_idx" ON "aliases"("domain");