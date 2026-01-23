-- 1. Create League table
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sportType" "SportType" NOT NULL DEFAULT 'OTHER',
    "logo" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "managerId" INTEGER,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- 2. Add foreign key for manager
ALTER TABLE "League" ADD CONSTRAINT "League_managerId_fkey" 
    FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Create default leagues for each existing sportType in seasons
INSERT INTO "League" ("name", "sportType", "updatedAt")
SELECT DISTINCT 
    CONCAT(INITCAP(REPLACE("sportType"::text, '_', ' ')), ' League') as "name",
    "sportType",
    NOW()
FROM "Season"
WHERE "sportType" IS NOT NULL;

-- 4. Add leagueId column to Season (nullable initially for data migration)
ALTER TABLE "Season" ADD COLUMN "leagueId" INTEGER;

-- 5. Update seasons to point to their corresponding default league
UPDATE "Season" s
SET "leagueId" = l.id
FROM "League" l
WHERE s."sportType" = l."sportType";

-- 6. Make leagueId required
ALTER TABLE "Season" ALTER COLUMN "leagueId" SET NOT NULL;

-- 7. Add foreign key constraint
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" 
    FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Remove sportType from Season (data now lives in League)
ALTER TABLE "Season" DROP COLUMN "sportType";
