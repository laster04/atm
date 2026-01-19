-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('FOOTBALL', 'BASKETBALL', 'VOLLEYBALL', 'HOCKEY', 'TENNIS', 'HANDBALL', 'FLOORBALL', 'OTHER');

-- Convert existing data: Map current string values to enum
-- First add a new column with the enum type
ALTER TABLE "Season" ADD COLUMN "sportType_new" "SportType" DEFAULT 'OTHER';

-- Update the new column based on existing values (case-insensitive match)
UPDATE "Season" SET "sportType_new" = 
  CASE 
    WHEN UPPER("sportType") = 'FOOTBALL' THEN 'FOOTBALL'::"SportType"
    WHEN UPPER("sportType") = 'BASKETBALL' THEN 'BASKETBALL'::"SportType"
    WHEN UPPER("sportType") = 'VOLLEYBALL' THEN 'VOLLEYBALL'::"SportType"
    WHEN UPPER("sportType") = 'HOCKEY' THEN 'HOCKEY'::"SportType"
    WHEN UPPER("sportType") = 'TENNIS' THEN 'TENNIS'::"SportType"
    WHEN UPPER("sportType") = 'HANDBALL' THEN 'HANDBALL'::"SportType"
    WHEN UPPER("sportType") = 'FLOORBALL' THEN 'FLOORBALL'::"SportType"
    ELSE 'OTHER'::"SportType"
  END;

-- Drop the old column
ALTER TABLE "Season" DROP COLUMN "sportType";

-- Rename the new column to the original name
ALTER TABLE "Season" RENAME COLUMN "sportType_new" TO "sportType";

-- Set NOT NULL and default
ALTER TABLE "Season" ALTER COLUMN "sportType" SET NOT NULL;
ALTER TABLE "Season" ALTER COLUMN "sportType" SET DEFAULT 'OTHER';
