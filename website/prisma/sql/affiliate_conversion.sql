-- Additive: create AffiliateConversion only. Column/index names match Prisma's
-- naming convention so a future `prisma db push` sees the table as in-sync.
CREATE TABLE IF NOT EXISTS "AffiliateConversion" (
  "id"          TEXT NOT NULL,
  "clickId"     TEXT,
  "network"     TEXT NOT NULL,
  "orderId"     TEXT NOT NULL,
  "saleAmount"  DOUBLE PRECISION,
  "commission"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"    TEXT NOT NULL DEFAULT 'USD',
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "slug"        TEXT,
  "utmCampaign" TEXT,
  "utmSource"   TEXT,
  "rawPayload"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateConversion_network_orderId_key" ON "AffiliateConversion" ("network", "orderId");
CREATE INDEX IF NOT EXISTS "AffiliateConversion_clickId_idx" ON "AffiliateConversion" ("clickId");
CREATE INDEX IF NOT EXISTS "AffiliateConversion_createdAt_idx" ON "AffiliateConversion" ("createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateConversion_network_idx" ON "AffiliateConversion" ("network");
CREATE INDEX IF NOT EXISTS "AffiliateConversion_utmCampaign_idx" ON "AffiliateConversion" ("utmCampaign");
